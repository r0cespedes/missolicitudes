
sap.ui.define([
    "sap/ui/base/Object",
    "../model/formatter",
    "sap/ui/core/mvc/View",
    "sap/m/Page",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ScrollContainer",
    "sap/m/Panel",
    "sap/ui/layout/Grid",
    "../service/Service",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../Utils/Util",
    "../Utils/Lenguaje",
    "sap/ui/model/json/JSONModel",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "../Utils/DialogManager",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Link",
    "sap/m/FlexBox",
    "sap/ui/unified/FileUploader",
    "sap/ui/core/Icon",


], function (BaseObject,
    formatter,
    View,
    Page,
    Label,
    Input,
    DatePicker,
    SimpleForm,
    MessageToast,
    Button,
    Toolbar,
    ToolbarSpacer,
    ScrollContainer,
    Panel,
    Grid,
    Service,
    Filter,
    FilterOperator,
    Util,
    Lenguaje,
    JSONModel,
    Select,
    Item,
    MessageBox,
    library,
    DialogManager,
    Table,
    Column,
    ColumnListItem,
    Text,
    Link,
    FlexBox,
    FileUploader,
    Icon,
) {
    "use strict";
    const ValueState = library.ValueState;

    return BaseObject.extend("com.inetum.missolicitudes.dinamic.DinamicFields", {
        formatter: formatter,

        constructor: function (oController) {
            BaseObject.prototype.constructor.apply(this, arguments);
            this._oController = oController;
            this._oMainView = oController.getView();

        },

        /**
         * Mostrar vista de detalle dinámica
         */
        showDynamicDetailView: async function (sSolicitudId, bEditMode = false) {
            await Util.getModelMainAndValidateSession(this._oController);
            try {
                Util.showBI(true);

                // Buscar la solicitud en los datos ya cargados
                var oSolicitud = this._findSolicitudById(sSolicitudId);
                if (!oSolicitud) {
                    MessageToast.show("Solicitud no encontrada: " + sSolicitudId);
                    Util.showBI(false);
                    return;
                }

                // Cargar campos dinámicos DM_0003
                var aDynamicFields = await this._loadDynamicFields(sSolicitudId);

                if (aDynamicFields.length === 0) Util.showBI(false);

                if (bEditMode) {
                    this._saveOriginalValues(aDynamicFields);
                }

                // Crear la vista dinámica
                var oDetailView = this._createDetailView(oSolicitud, aDynamicFields, bEditMode, this._oController);

                // Navegar a la vista
                this._navigateToDetailView(oDetailView);



            } catch (error) {
                Util.showBI(false);
                MessageToast.show("Error al cargar vista de detalle: " + error.message);
                console.error("Error showDynamicDetailView:", error);
            }
        },

        _saveOriginalValues: function (aDynamicFields) {
            var oOriginalValues = {};

            aDynamicFields.forEach(function (field) {
                oOriginalValues[field.externalCode] = {
                    value: field.cust_value || "",
                    fieldType: field.cust_fieldtype,
                    pickList: field.cust_picklist,
                    fullFieldData: field
                };
            });

            var oOriginalModel = new JSONModel({
                fields: oOriginalValues,
                dynamicFields: aDynamicFields
            });

            this._oMainView.setModel(oOriginalModel, "originalFieldValues");
        },

        _getChangedFields: function () {
            var aChangedFields = [];

            if (!this._dynamicFields || !this._fieldControlsMap) {
                console.error("Faltan datos para detectar cambios (campos o controles).");
                return [];
            }

            // Formateador de fechas para asegurar que la comparación sea de string a string
            var oDateFormatter = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });

            this._dynamicFields.forEach(function (field) {
                var oControl = this._fieldControlsMap[field.externalCode];
                if (!oControl) return;

                var vOriginalValue = oControl.data("realValue");
                var vCurrentValue = null;
                var vCurrentText = null;

                // obtener el valor actual
                if (oControl instanceof Select) {
                    vCurrentValue = oControl.getSelectedKey();

                    // Si es tipo P, también obtener el texto
                    if (field.cust_fieldtype === 'P') {
                        var oSelectedItem = oControl.getSelectedItem();
                        vCurrentText = oSelectedItem ? oSelectedItem.getText() : "";
                    }
                } else if (field.cust_fieldtype === 'P') {
                    vCurrentValue = vOriginalValue;
                } else if (oControl instanceof DatePicker) {
                    vCurrentValue = oControl.getDateValue() ? oDateFormatter.format(oControl.getDateValue()) : "";
                } else if (oControl.getValue) {
                    vCurrentValue = oControl.getValue();
                } else {
                    return;
                }

                if ((vOriginalValue || "") !== (vCurrentValue || "")) {
                    aChangedFields.push({
                        fieldData: field,
                        newValue: vCurrentValue,
                        newText: vCurrentText
                    });
                }
            }.bind(this));

            return aChangedFields;
        },

        _buildFieldEntityPath: function (sDM0001ExternalCode, sEffectiveStartDate, sFieldExternalCode) {
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            var sEntityPath = `/cust_INETUM_SOL_DM_0003(` +
                `cust_INETUM_SOL_DM_0001_effectiveStartDate=datetime'${sFormattedDate}',` +
                `cust_INETUM_SOL_DM_0001_externalCode='${sDM0001ExternalCode}',` +
                `externalCode='${sFieldExternalCode}')`;

            return sEntityPath;
        },

        /**
         * Buscar solicitud por ID
         */
        _findSolicitudById: function (sSolicitudId) {
            var oSolicitudesModel = this._oMainView.getModel("solicitudes");
            var aSolicitudes = oSolicitudesModel.getProperty("/solicitudes/results");

            return aSolicitudes.find(function (item) {
                return item.externalCode === sSolicitudId;
            });
        },

        /**
         * Cargar campos dinámicos desde DM_0003
         */
        _loadDynamicFields: async function (sSolicitudId) {
            try {

                var oSolicitud = this._findSolicitudById(sSolicitudId);
                if (!oSolicitud) {
                    throw new Error("Solicitud no encontrada");
                }

                var aCampos = oSolicitud.cust_solFields.results;
                if (!aCampos) {
                    return [];
                }
                const aCamposActivos = aCampos.filter(oCampo => oCampo.cust_status === 'A');
                return aCamposActivos;

            } catch (error) {
                console.error("Error cargando campos dinámicos:", error);
                return [];
            }
        },

        /**
         * Crear vista de detalle con Panel y márgenes
         */
        _createDetailView: function (oSolicitud, aDynamicFields, bEditMode = false) {
            var that = this;
            this._dynamicFields = aDynamicFields;
            this._updateResourceBundle();

            // Crear formulario simple
            var oForm = this._createSimpleForm(oSolicitud, aDynamicFields, bEditMode);

            // Crear Panel que contenga el formulario
            var oPanel = this._createPanelWithForm(oForm, oSolicitud);

            // VerticalLayout con márgenes para contener el panel
            var oLayoutWithMargins = this._createLayoutWithMargins(oPanel);

            // ScrollContainer
            var oScrollContainer = new ScrollContainer({
                height: "100%",
                horizontal: false,
                vertical: true,
                content: [oLayoutWithMargins]
            });

            var oCancelRequestButton = new Button({
                text: this.oResourceBundle.getText("cancelRequest"),
                type: "Reject",
                visible: oSolicitud.cust_status === "EC" || oSolicitud.cust_status === "PF",
                press: function () {
                    that._onCancelRequest(oSolicitud, oDetailView);
                }
            });

            // Botones del footer

            var oSaveButton = new Button({
                text: this.oResourceBundle.getText("save"),
                type: "Accept",
                visible: bEditMode,
                press: function () {
                    that._onSaveChanges(oSolicitud, oDetailView);
                }
            });

            var oCloseButton = new Button({
                text: this.oResourceBundle.getText("close"),
                type: "Emphasized",
                press: function () {
                    that._onBackToMain(oDetailView);
                }
            });

            var oFooterToolbar = new Toolbar({
                content: [
                    new ToolbarSpacer(),
                    oCancelRequestButton,
                    oSaveButton,
                    oCloseButton
                ]
            });

            // Página
            var oPage = new Page({
                title: oSolicitud.cust_nombreSol,
                showNavButton: true,
                navButtonPress: function () {
                    that._onBackToMain(oDetailView);
                },
                content: [oScrollContainer],
                footer: oFooterToolbar
            });

            // Vista
            var oDetailView = new View({
                id: "dynamicDetailView_" + Date.now(),
                content: [oPage]
            });

            this._oCurrentDetailView = oDetailView;

            return oDetailView;
        },

        _onSaveChanges: function (oSolicitud, oDetailView) {
            var that = this;

            //  validar el formulario
            if (!this.validateForm()) {
                const sErrorMessage = this.oResourceBundle.getText("validation.fillMandatoryFields");
                Util.onShowMessage(sErrorMessage, "error");
                return;
            }

            var aChangedFields = this._getChangedFields();
            var oAttachmentChange = this._getAttachmentChanges();

            if (aChangedFields.length === 0 && !oAttachmentChange) {
                MessageToast.show(this.oResourceBundle.getText("noChangesDetected"));
                return;
            }

            const oDialogModel = new JSONModel({
                icon: "sap-icon://save",
                type: this.oResourceBundle.getText("saveConfirmation"),
                state: "Information",
                message: this.oResourceBundle.getText("saveChangesConfirmation"),
                acceptText: this.oResourceBundle.getText("save"),
                cancelText: this.oResourceBundle.getText("cancel"),
                showAddCommentLink: true
            });

            DialogManager.open(this._oMainView, oDialogModel, {
                onAccept: function (sComment) {
                    that._performSave(oSolicitud, oDetailView, aChangedFields, oAttachmentChange);
                },
                onCancel: function () {
                    console.log("Guardado cancelado por el usuario");
                }
            }).catch(function (error) {
                console.log("Guardado cancelado por el usuario");
            });
        },

        _performSave: function (oSolicitud, oDetailView, aChangedFields, aAttachmentChanges) {
            var that = this;
            Util.showBI(true);
            const oModel = this._oController.getOwnerComponent().getModel();

            // Guardar campos normales (no attachments)
            var aNormalChangedFields = aChangedFields.filter(function (change) {
                return change.fieldData.cust_fieldtype !== 'A';
            });

            aNormalChangedFields.forEach(function (change) {
                var sFieldPath = that._buildFieldEntityPath(
                    oSolicitud.externalCode,
                    oSolicitud.effectiveStartDate,
                    change.fieldData.externalCode
                );
                var oUpdateData = {};

                if (change.fieldData.cust_fieldtype === 'P' && change.newText) {
                    // Para campos tipo Picklist: key en cust_label_value, text en cust_value
                    oUpdateData.cust_label_value = change.newText || "";
                    oUpdateData.cust_value = change.newValue || "";
                } else {
                    // Para otros tipos de campo: valor en cust_value
                    oUpdateData.cust_value = change.newValue || "";
                }

                oModel.update(sFieldPath, oUpdateData);
            });

            // Procesar attachments si hay cambios
            if (aAttachmentChanges && aAttachmentChanges.length > 0) {

                this._processAttachmentsOneByOne(
                    oSolicitud,
                    aAttachmentChanges,
                    oModel,
                    function () {
                        setTimeout(function () {
                            that._finalizeUpdate(oSolicitud, oDetailView);
                        }, 1000);
                    },
                    function (error) {
                        console.error("Error procesando attachments:", error);
                        MessageToast.show("Error al procesar archivos: " + (error.message || error));
                        Util.showBI(false);
                    }
                );
            } else {
                setTimeout(function () {
                    that._finalizeUpdate(oSolicitud, oDetailView);
                }, 1000);
            }
        },

        _processAttachmentsOneByOne: function (oSolicitud, aAttachmentChanges, oModel, fnSuccess, fnError) {
            const that = this;

            const iTotalOperations = aAttachmentChanges.length;
            let iCompletedOperations = 0;
            let bHasError = false;

            if (iTotalOperations === 0) {
                fnSuccess();
                return;
            }
            // Función para verificar si se completaron todas las operaciones
            const checkComplete = function () {
                iCompletedOperations++;

                if (iCompletedOperations === iTotalOperations && !bHasError) {
                    fnSuccess();
                }
            };


            aAttachmentChanges.forEach(function (oChange, index) {
                if (bHasError) return;

                if (oChange.action === "upload") {
                    that._uploadAndCreateRecord(
                        oSolicitud,
                        oChange,
                        oModel,
                        function () {
                            checkComplete();
                        },
                        function (error) {
                            if (!bHasError) {
                                bHasError = true;
                                console.error(`[${index + 1}/${iTotalOperations}] Error:`, error);
                                fnError(error);
                            }
                        }
                    );
                } else if (oChange.action === "delete") {
                    // Desactivar registro DM_0003
                    that._eliminarRegistroDM0003(
                        oSolicitud,
                        oChange,
                        oModel,
                        function () {
                            checkComplete();
                        },
                        function (error) {
                            if (!bHasError) {
                                bHasError = true;
                                console.error(`[${index + 1}/${iTotalOperations}] Error:`, error);
                                fnError(error);
                            }
                        }
                    );
                }
            });
        },

        _uploadAndCreateRecord: function (oSolicitud, oChange, oModel, fnSuccess, fnError) {
            const that = this;

            // Subir el archivo a /Attachment
            const oDatosAdjunto = {
                fileName: oChange.file.nombre,
                fileContent: oChange.file.contenido,
                module: "GENERIC_OBJECT",
                userId: "SFAPI"
            };

            oModel.create("/Attachment", oDatosAdjunto, {
                success: function (oData) {
                    const sAttachmentId = oData.attachmentId;

                    // Crear registro DM_0003
                    that._createDM0003Record(
                        oSolicitud,
                        oChange.fieldData,
                        sAttachmentId,
                        oModel,
                        fnSuccess,
                        fnError
                    );
                },
                error: function (oError) {
                    console.error("Error subiendo archivo:", oError);
                    fnError(oError);
                }
            });
        },

        _eliminarRegistroDM0003: function (oSolicitud, oChange, oModel, fnSuccess, fnError) {
            const that = this;
            const sAttachmentId = oChange.oldAttachmentId;

            const aFilters = [
                new Filter("cust_INETUM_SOL_DM_0001_externalCode", FilterOperator.EQ, oSolicitud.externalCode),
                new Filter("cust_value", FilterOperator.EQ, sAttachmentId),
                new Filter("cust_fieldtype", FilterOperator.EQ, "A"),
                new Filter("cust_status", FilterOperator.EQ, "A")
            ];

            oModel.read("/cust_INETUM_SOL_DM_0003", {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        const oRecord = oData.results[0];

                        const sRecordPath = that._buildFieldEntityPath(
                            oSolicitud.externalCode,
                            oSolicitud.effectiveStartDate,
                            oRecord.externalCode
                        );

                        // ELIMINAR el registro usando submitChanges
                        oModel.remove(sRecordPath);

                        oModel.submitChanges({
                            success: function (oResponse) {
                                if (fnSuccess) fnSuccess();
                            },
                            error: function (oError) {
                                console.error("Error eliminando DM_0003:", oError);
                                if (fnError) fnError(oError);
                            }
                        });
                    } else {
                        console.warn("No se encontró registro DM_0003");
                        if (fnSuccess) fnSuccess();
                    }
                },
                error: function (oError) {
                    console.error("Error buscando DM_0003:", oError);
                    if (fnError) fnError(oError);
                }
            });
        },

        _createDM0003Record: function (oSolicitud, oFieldData, sAttachmentId, oModel, fnSuccess, fnError) {
            // Generar externalCode único
            const sNewExternalCode = formatter.generarIdNumericoUnico();

            // Datos del nuevo registro
            const oNewRecord = {
                cust_INETUM_SOL_DM_0001_externalCode: oSolicitud.externalCode,
                cust_INETUM_SOL_DM_0001_effectiveStartDate: formatter._formatEffectiveStartDate(oSolicitud.effectiveStartDate),
                externalCode: sNewExternalCode,
                cust_value: sAttachmentId, // Solo un attachmentId
                cust_etiqueta: oFieldData.cust_etiqueta,
                cust_etiqueta_ca_ES: oFieldData.cust_etiqueta_ca_ES,
                cust_etiqueta_defaultValue: oFieldData.cust_etiqueta_defaultValue,
                cust_etiqueta_en_DEBUG: oFieldData.cust_etiqueta_en_DEBUG,
                cust_etiqueta_en_US: oFieldData.cust_etiqueta_en_US,
                cust_etiqueta_es_ES: oFieldData.cust_etiqueta_es_ES,
                cust_fieldtype: "A",
                cust_fieldLenght: oFieldData.cust_fieldLenght,
                cust_mandatory: oFieldData.cust_mandatory || false,
                cust_modif: oFieldData.cust_modif || false,
                cust_ModificablePEmpleado: oFieldData.cust_ModificablePEmpleado || false,
                cust_object: oFieldData.cust_object,
                cust_tipoObject: oFieldData.cust_tipoObject,
                cust_status: "A" // Activo
            };


            // Crear el registro
            oModel.create("/cust_INETUM_SOL_DM_0003", oNewRecord, {
                success: function (oData) {
                    fnSuccess(oData);
                },
                error: function (oError) {
                    console.error("Error creando registro DM_0003:", oError);

                    // Intentar extraer mensaje de error
                    let sErrorMsg = "Error desconocido";
                    if (oError && oError.responseText) {
                        try {
                            const oErrorData = JSON.parse(oError.responseText);
                            sErrorMsg = oErrorData.error?.message?.value || oError.message || sErrorMsg;
                        } catch (e) {
                            sErrorMsg = oError.message || oError.statusText || sErrorMsg;
                        }
                    }

                    fnError(new Error(sErrorMsg));
                }
            });
        },


        _finalizeUpdate: function (oSolicitud, oDetailView) {
            var that = this;
            const oModel = this._oController.getOwnerComponent().getModel();

            if (this._fieldControlsMap) {
                Object.keys(this._fieldControlsMap).forEach(function (sKey) {
                    const oControl = that._fieldControlsMap[sKey];
                    if (oControl && oControl.data) {
                        oControl.data("pendingFiles", []);
                        oControl.data("deletedAttachments", []);
                    }
                });
            }

            this._oController._archivosParaSubir = null;

            var sEntityPath = this._oController._buildEntityPath(
                oSolicitud.externalCode,
                oSolicitud.effectiveStartDate
            );

            const iCurrentIndexStep = parseInt(oSolicitud.cust_indexStep, 10) || 0;
            const iNewIndexStep = (iCurrentIndexStep >= 1) ? iCurrentIndexStep + 1 : iCurrentIndexStep;

            const oDatos_DM_0001 = {
                cust_status: "EC",
                cust_indexStep: iNewIndexStep,
                cust_fechaAct: new Date()
            };

            oModel.update(sEntityPath, oDatos_DM_0001, {
                success: function () {
                    console.log("DM_0001 Actualizado")
                },
                error: function (oError) {
                    console.log("Error al guardar cambios", "error");
                    Util.showBI(false);
                }
            });

            oSolicitud.cust_indexStep = iNewIndexStep;
            that.onSearchSteps(oSolicitud, iNewIndexStep);
            that._oController._archivosParaSubir = null;

            MessageToast.show(that.oResourceBundle.getText("ChangesSavedSuccessfully"));
            that._onBackToMain(oDetailView);

            setTimeout(function () {
                that._oController.onGetDM001();
            }, 1500);

            Util.showBI(false);
        },

        _getAttachmentChanges: function () {
            const aAllChanges = [];

            // Si existe el sistema agrupado, usarlo
            if (this._groupedAttachmentsData) {
                const oModel = this._groupedAttachmentsData.model;
                const aPendingFiles = oModel.getProperty("/pendingFiles") || [];
                const aDeletedAttachments = oModel.getProperty("/deletedAttachments") || [];
                const aAttachmentFields = this._groupedAttachmentsData.attachmentFields || [];

                // Obtener el primer campo de attachment para usar su metadata            
                const oFirstField = aAttachmentFields[0];

                // Agregar archivos nuevos
                aPendingFiles.forEach(function (oFile) {
                    aAllChanges.push({
                        action: "upload",
                        file: oFile,
                        fieldData: oFirstField // Se usa el primer campo como referencia
                    });
                });

                // Agregar archivos eliminados
                aDeletedAttachments.forEach(function (oDeletedItem) {
                    aAllChanges.push({
                        action: "delete",
                        fieldData: oFirstField,
                        oldAttachmentId: oDeletedItem.attachmentId
                    });
                });

                return aAllChanges.length > 0 ? aAllChanges : null;
            }

            // Fallback: Si no existe sistema agrupado, usar el método original
            if (!this._dynamicFields || !this._fieldControlsMap) {
                return aAllChanges;
            }

            this._dynamicFields.forEach(function (field) {
                if (field.cust_fieldtype === "A") {
                    const oControl = this._fieldControlsMap[field.externalCode];

                    if (!oControl) return;

                    const aPendingFiles = oControl.data("pendingFiles") || [];
                    const aDeletedAttachments = oControl.data("deletedAttachments") || [];

                    // Agregar archivos nuevos
                    aPendingFiles.forEach(function (oFile) {
                        aAllChanges.push({
                            action: "upload",
                            file: oFile,
                            fieldData: field
                        });
                    });

                    // Agregar archivos eliminados
                    aDeletedAttachments.forEach(function (sAttachmentId) {
                        aAllChanges.push({
                            action: "delete",
                            fieldData: field,
                            oldAttachmentId: sAttachmentId
                        });
                    });
                }
            }.bind(this));

            return aAllChanges.length > 0 ? aAllChanges : null;
        },

        onSearchSteps: function (oSolicitud, iNewIndexStep) {
            const oModel = this._oController.getOwnerComponent().getModel();

            for (let i = 0; i < oSolicitud.cust_steps.results.length; i++) {
                const oStep = oSolicitud.cust_steps.results[i];
                const iStepNumber = parseInt(oStep.cust_seqStep, 10);

                const bNewActiveStatus = (iStepNumber === iNewIndexStep);

                // Solo actualizar si cambió el estado
                if (oStep.cust_activeStep !== bNewActiveStatus) {
                    const sStepPath = this._buildStepEntityPath(
                        oSolicitud.externalCode,
                        oSolicitud.effectiveStartDate,
                        oStep.externalCode
                    );

                    const oDatos_DM_0002 = {
                        cust_activeStep: bNewActiveStatus
                    };

                    oModel.update(sStepPath, oDatos_DM_0002, {
                        success: function (oData, oResponse) {
                            console.log("Step", iStepNumber, "actualizado a:", bNewActiveStatus);
                        },
                        error: function (oError) {
                            console.error("Error step", iStepNumber, oError);
                        }
                    });
                }
            }
        },

        /**
         * Construir path de entidad para DM_0002 (steps)
         */
        _buildStepEntityPath: function (sDM0001ExternalCode, sEffectiveStartDate, sStepExternalCode) {
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            var sEntityPath = `/cust_INETUM_SOL_DM_0002(` +
                `cust_INETUM_SOL_DM_0001_effectiveStartDate=datetime'${sFormattedDate}',` +
                `cust_INETUM_SOL_DM_0001_externalCode='${sDM0001ExternalCode}',` +
                `externalCode='${sStepExternalCode}')`;

            return sEntityPath;
        },

        _cargarOpcionesPicklist: async function (sPicklistId) {
            if (sPicklistId === "Tipus de carnet") {
                sPicklistId = "Tipus_de_carnet";
            }

            try {
                const oModel = this._oController.getOwnerComponent().getModel();
                const sLang = this._oController.getOwnerComponent().getModel("user").oData.defaultLocale;
                const oParametrosPicklist = {
                    bParam: true,
                    oParameter: {
                        "$filter": `picklist/picklistId eq '${sPicklistId}' and status eq 'ACTIVE'`,
                        "$expand": "picklistLabels",
                        "$format": "json"
                    }
                };
                const sRutaEntidad = `/PicklistOption`;
                const oRespuesta = await Service.readDataERP(sRutaEntidad, oModel, [], oParametrosPicklist);

                const aOpciones = [];
                const mMap = {
                    "es_ES": "es_ES",
                    "en_US": "en_US",
                    "ca_ES": "ca_ES",
                    "en_DEBUG": "en_US"
                };
                const sLocaleBuscado = mMap[sLang];

                if (oRespuesta.data?.results) {
                    oRespuesta.data.results.forEach(oOption => {
                        const oLabelEncontrado = sLocaleBuscado
                            ? oOption.picklistLabels.results.find(label => label.locale === sLocaleBuscado)
                            : undefined;
                        if (oLabelEncontrado) {
                            aOpciones.push({
                                key: oLabelEncontrado.optionId,
                                text: oLabelEncontrado.label
                            });
                        }
                    });
                }
                return aOpciones;

            } catch (oError) {
                const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                console.warn(oResourceBundle.getText("warn.picklistLoadFailed", [sPicklistId]), oError);
                return [];
            }
        },


        _updateResourceBundle: function () {
            try {
                var oI18nModel = this._oController.getOwnerComponent().getModel("i18n");
                if (oI18nModel) {
                    this.oResourceBundle = oI18nModel.getResourceBundle();
                }
            } catch (error) {
                console.error("Error actualizando ResourceBundle:", error);
            }
        },

        /**
         * Crear Panel que contiene el formulario
         */
        _createPanelWithForm: function (oForm) {
            var oPanel = new Panel({
                headerText: this.oResourceBundle.getText("requestDetails"), // this.oResourceBundle.getText("requestDetails")
                expandable: false,
                expanded: false,
                backgroundDesign: "Translucent",
                content: [oForm],
                width: "100%"
            });

            return oPanel;
        },

        /**
         * Crear layout con márgenes alrededor del panel usando Grid
         */
        _createLayoutWithMargins: function (oPanel) {
            // Usar Grid para centrar el panel de forma nativa
            var oGrid = new Grid({
                defaultSpan: "XL12 L12 M12 S12",
                hSpacing: 1,
                vSpacing: 1,
                content: [oPanel]
            });

            oGrid.addStyleClass("sapUiMediumMarginTop");

            return oGrid;
        },

        /**
         * Crear formulario simple con campos básicos + dinámicos
         */
        _createSimpleForm: function (oSolicitud, aDynamicFields, bEditMode = false) {
            var oForm = new SimpleForm({
                editable: bEditMode,
                layout: "ResponsiveGridLayout",
                // Configuración para dos columnas con espaciado reducido
                labelSpanXL: 4,
                labelSpanL: 4,
                labelSpanM: 4,
                labelSpanS: 12,
                adjustLabelSpan: false,
                emptySpanXL: 0,
                emptySpanL: 0,
                emptySpanM: 0,
                emptySpanS: 0,
                // Configurar para 2 columnas en pantallas grandes
                columnsXL: 2,
                columnsL: 2,
                columnsM: 1,
                content: []
            });

            this._fieldControlsMap = {};

            // Agregar campos dinámicos directamente
            this._addDynamicFields(oForm, aDynamicFields, oSolicitud, bEditMode);

            return oForm;
        },

        /**
         * Agregar campos dinámicos (todos los registros del array)
         */
        _addDynamicFields: async function (oForm, aDynamicFields, oSolicitud, bEditMode = false) {

            const user = this._oController.oCurrentUser.name;
            const oResourceModel = this._oController.getOwnerComponent().getModel("i18n");
            const sLang = oResourceModel.getResourceBundle().sLocale;
            const oModel = this._oController.getOwnerComponent().getModel();

            if (!aDynamicFields || aDynamicFields.length === 0) {
                Util.showBI(false);
                return;
            }

            this._oSolicitud = oSolicitud;

            // Separar campos por tipo
            const aAttachmentFields = [];
            const aNormalFields = [];

            aDynamicFields.forEach(field => {
                if (field.cust_fieldtype === "A") {
                    aAttachmentFields.push(field);
                } else {
                    aNormalFields.push(field);
                }
            });

            const aFieldsDataPromises = aNormalFields.map(async (oDynamicField) => {
                const bUsuarioEsCreador = (user === oSolicitud.createdBy);
                let bEsEditable = oDynamicField.cust_modif === true && bEditMode && oSolicitud.cust_status === "RA";
                let bEsObligatorio = !!oDynamicField.cust_mandatory;

                if (bUsuarioEsCreador && !oDynamicField.cust_ModificablePEmpleado) {
                    bEsEditable = false;
                    bEsObligatorio = false;
                }

                const sLabel = Lenguaje.obtenerValorLocalizado(oDynamicField, "cust_etiqueta").replace(/:$/, "");
                let sValue = oDynamicField.cust_fieldtype === "P" ? (oDynamicField.cust_label_value || "") : (oDynamicField.cust_value || "");
                let sDisplayValue = sValue;
                let aOpcionesPicklist = [];

                // Cargar picklist si es necesario
                if (oDynamicField.cust_fieldtype === "P") {
                    if (bEsEditable) {
                        try {
                            const sPicklistId = oDynamicField.cust_picklist;
                            if (sPicklistId) {
                                aOpcionesPicklist = await this._cargarOpcionesPicklist(sPicklistId);
                            }
                            sDisplayValue = sValue;
                        } catch (error) {
                            console.error("Error cargando picklist:", error);
                            aOpcionesPicklist = [];
                        }
                    } else if (sValue !== "" && sValue.trim() !== "") {
                        try {
                            const aFilter = [new Filter("optionId", FilterOperator.EQ, sValue)];
                            const data = await Service.readDataERP("/PicklistLabel", oModel, aFilter);

                            const mMap = {
                                "es_ES": "es_ES",
                                "en_US": "en_US",
                                "ca_ES": "ca_ES",
                                "en_DEBUG": "en_US"
                            };
                            const sLocaleBuscado = mMap[sLang];

                            if (data?.data?.results?.length) {
                                sDisplayValue = data.data.results.find(label => label.locale === sLocaleBuscado)?.label || sValue;
                            }
                        } catch (error) {
                            console.error("Error cargando picklist label:", error);
                        }
                    }
                }

                if (oDynamicField.cust_fieldtype === "URL") {
                    sValue = oDynamicField.cust_vDefecto;
                    sDisplayValue = oDynamicField.cust_vDefecto;
                }

                return {
                    field: oDynamicField,
                    config: {
                        oForm,
                        sLabel,
                        sValue: sDisplayValue,
                        realValue: sValue,
                        fieldType: oDynamicField.cust_fieldtype,
                        fieldValue: oDynamicField.cust_value,
                        editable: bEsEditable,
                        sStatusEditable: oDynamicField.cust_modif,
                        mandatory: bEsObligatorio,
                        externalCode: oDynamicField.externalCode,
                        picklistOptions: aOpcionesPicklist,
                        length: oDynamicField.cust_fieldLenght,
                        sDefaultWidth: `25rem`
                    }
                };
            });

            // Cargar adjuntos en paralelo
            let aAllAttachments = [];
            let bAnyAttachmentEditable = false;

            if (aAttachmentFields.length > 0) {
                const bUsuarioEsCreador = (user === oSolicitud.createdBy);
                bAnyAttachmentEditable = this._checkIfAnyFieldIsEditable(
                    aAttachmentFields,
                    bEditMode,
                    oSolicitud,
                    bUsuarioEsCreador
                );

                // Cargar todos los attachments
                aAllAttachments = await this._loadAllGroupedAttachments(aAttachmentFields, bAnyAttachmentEditable);
            }

            // Esperar a que todos los campos normales estén preparados
            const aFieldsData = await Promise.all(aFieldsDataPromises);

            // Renderizar campos normales
            aFieldsData.forEach(fieldData => {
                this._addField(fieldData.config);
            });

            // Renderizar attachments agrupados si existen
            if (aAttachmentFields.length > 0) {
                const oFieldConfig = {
                    oForm: oForm,
                    sLabel: Lenguaje.obtenerValorLocalizado(aAttachmentFields[0], "cust_etiqueta").replace(/:\s*$/, ""),
                    mandatory: aAttachmentFields.some(f => f.cust_mandatory === true)
                };

                // Crear el componente de attachments con los datos ya cargados
                await this._createGroupedAttachmentsComponent(
                    oFieldConfig,
                    aAttachmentFields,
                    oSolicitud,
                    bEditMode,
                    aAllAttachments,
                    bAnyAttachmentEditable
                );
            }

            // Ocultar indicador de carga
            Util.showBI(false);
        },

        _createGroupedAttachmentsComponent: async function (
            oFieldConfig,
            aAttachmentFields,
            oSolicitud,
            bEditMode,
            aPreloadedAttachments,
            bAnyEditable
        ) {
            const that = this;

            // Crear modelo con los attachments ya cargados
            const oAttachmentsModel = new JSONModel({
                items: aPreloadedAttachments,
                pendingFiles: [],
                deletedAttachments: [],
                uploadEnabled: bAnyEditable
            });

            // Crear tabla
            const sTableId = "grouped_attachments_table_" + Date.now();
            const oTable = new Table({
                id: sTableId,
                mode: bAnyEditable ? "Delete" : "None",
                growing: false,
                columns: [
                    new Column({
                        width: "3rem",
                        hAlign: "Center",
                        header: new Text({ text: "" })
                    }),
                    new Column({
                        header: new Text({ text: this.oResourceBundle.getText("fileName") || "Nombre del archivo" }),
                        width: "50%"
                    }),
                    new Column({
                        header: new Text({ text: this.oResourceBundle.getText("fileSize") || "Tamaño" }),
                        width: "30%",
                        hAlign: "Right"
                    })
                ],
                delete: function (oEvent) {
                    that._onDeleteGroupedAttachment(oEvent, oTable, oAttachmentsModel);
                }
            });

            // Vincular items al modelo
            oTable.bindItems({
                path: "attachments>/items",
                template: new ColumnListItem({
                    cells: [
                        new Icon({
                            src: {
                                path: "attachments>mediaType",
                                formatter: formatter._getFileIcon
                            },
                            size: "2rem",
                            color: "Default"
                        }),
                        new Link({
                            text: "{attachments>fileName}",
                            href: "#",
                            enabled: true,
                            press: function (oEvent) {
                                oEvent.preventDefault();
                                const oSource = oEvent.getSource();
                                const oContext = oSource.getBindingContext("attachments");
                                const oFileData = oContext.getObject();

                                const a = document.createElement('a');
                                a.href = oFileData.url;
                                a.download = oFileData.fileName;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }
                        }),
                        new Text({
                            text: {
                                path: "attachments>fileSize",
                                formatter: formatter._formatFileSize
                            }
                        })
                    ]
                })
            });

            oTable.setModel(oAttachmentsModel, "attachments");

            // FileUploader
            const sFileUploaderId = "grouped_file_uploader_" + Date.now();
            const oFileUploader = new FileUploader({
                id: sFileUploaderId,
                multiple: true,
                fileType: ["jpeg", "jpg", "png", "pdf"],
                mimeType: ["application/pdf", "image/jpeg", "image/jpg", "image/png"],
                maximumFileSize: 10,
                visible: true,
                width: "0px",
                change: function (oEvent) {
                    that._onGroupedFilesSelected(oEvent, oFileUploader, oTable, oAttachmentsModel);
                }
            }).addStyleClass("sapUiHidden");

            // Botón de carga
            const oUploadButton = new Button({
                text: this.oResourceBundle.getText("addAttachments") || "Agregar archivos",
                icon: "sap-icon://attachment",
                type: "Emphasized",
                visible: bAnyEditable,
                press: function () {
                    oFileUploader.$().find("input[type=file]").trigger("click");
                }
            });

            const oContent = new FlexBox({
                direction: "Column",
                items: [
                    oUploadButton,
                    oFileUploader,
                    oTable
                ]
            });

            // Panel con contador actualizado
            const oPanel = new Panel({
                width: "80%",
                headerText: `${this.oResourceBundle.getText("attachments")} (${aPreloadedAttachments.length})`,
                expandable: true,
                expanded: false,
                content: [oContent]
            });

            this._oPanel = oPanel;

            // Actualizar contador cuando cambien los items
            oAttachmentsModel.attachPropertyChange(function (oEvent) {
                if (oEvent.getParameter("path") === "/items") {
                    const iCount = oAttachmentsModel.getProperty("/items").length;
                    oPanel.setHeaderText(`${that.oResourceBundle.getText("attachments")} (${iCount})`);
                }
            });

            // Agregar al formulario
            const oLabel = new Label({
                text: oFieldConfig.sLabel,
                required: !!oFieldConfig.mandatory,
                labelFor: oTable.getId()
            });

            oFieldConfig.oForm.addContent(oLabel);
            oFieldConfig.oForm.addContent(oPanel);

            // Guardar referencias
            this._groupedAttachmentsData = {
                table: oTable,
                model: oAttachmentsModel,
                fileUploader: oFileUploader,
                attachmentFields: aAttachmentFields,
                panel: oPanel
            };

            // Mapear campos al control
            aAttachmentFields.forEach(function (oAttField) {
                that._fieldControlsMap[oAttField.externalCode] = oTable;
            });

            return oTable;
        },

        /**
         * Agregar un campo simple al formulario
         */
        _addField: function (oFieldConfig) {

            let sDisplayValue = oFieldConfig.sValue;
            let oField = null;
            let textoUrl = "";

            // Si el valor está vacío, mostrar texto por defectodeleteFile
            if (sDisplayValue === undefined || sDisplayValue === null || sDisplayValue === "") {
                sDisplayValue = "";
            }

            if (oFieldConfig.fieldType == "URL") {
                const oResourceBundle = this._oController.getOwnerComponent().getModel("i18n").getResourceBundle();
                textoUrl = oResourceBundle.getText("downloadDocument");
            }

            // Crear elementos
            var sFieldId = "field_" + oFieldConfig.externalCode;

            var oLabel = new Label({
                text: oFieldConfig.sLabel,
                labelFor: sFieldId,
                required: !!oFieldConfig.mandatory

            });



            switch (String(oFieldConfig.fieldType)) {
                case "P":
                    oField = this._createPicklistField(sFieldId, oFieldConfig);
                    break;
                case "F":
                    oField = this._createDateField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "I":
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "S":
                    oField = this._createTextAreaField(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "URL":
                    oField = this._createURLField(sFieldId, sDisplayValue, oFieldConfig.editable, textoUrl);
                    break;
                case "D":
                    oField = this._createInputDecimal(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "N":
                    oField = this._createInputNumber(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                case "T":
                    oField = this._createTimePicker(sFieldId, sDisplayValue, oFieldConfig);
                    break;
                default:
                    oField = this._createInputField(sFieldId, sDisplayValue, oFieldConfig);
            }

            if (oField && oFieldConfig.realValue !== undefined) {
                oField.data("realValue", oFieldConfig.realValue);
            }

            if (oField && oFieldConfig.externalCode) {
                this._fieldControlsMap[oFieldConfig.externalCode] = oField;
            }
            // Agregar al formulario
            oFieldConfig.oForm.addContent(oLabel);
            oFieldConfig.oForm.addContent(oField);

        },

        _createPicklistField: function (sFieldId, oFieldConfig) {

            if (oFieldConfig.editable && oFieldConfig.picklistOptions && oFieldConfig.picklistOptions.length > 0) {
                const oSelect = new Select({
                    id: sFieldId,
                    // width: oFieldConfig.length ? `${oFieldConfig.length}rem` : undefined,
                    selectedKey: oFieldConfig.realValue,
                    width: oFieldConfig.sDefaultWidth
                });

                const oOptionsModel = new JSONModel(oFieldConfig.picklistOptions);
                oSelect.setModel(oOptionsModel);

                oSelect.bindItems({
                    path: "/",
                    template: new Item({
                        key: "{key}",
                        text: "{text}"
                    })
                });

                return oSelect;

            } else {
                const oInput = new Input({
                    id: sFieldId,
                    value: oFieldConfig.sValue,
                    editable: false,
                    width: oFieldConfig.sDefaultWidth
                });
                return oInput;
            }

        },

        _createInputField: function (sFieldId, sDisplayValue, oFieldConfig) {
            const iLength = parseInt(oFieldConfig.length, 10) || 0;
            const bEditable = oFieldConfig.editable !== false;

            if (iLength > 0 && iLength <= 200) {
                // Input para textos cortos
                return new sap.m.Input({
                    id: sFieldId,
                    maxLength: iLength,
                    type: sap.m.InputType.Text,
                    width: `${Math.min(iLength, 40) * 0.9}rem`,
                    value: sDisplayValue,
                    editable: bEditable
                });
            }

            // TextArea para textos largos
            return new sap.m.TextArea({
                id: sFieldId,
                value: sDisplayValue,
                rows: 2,
                maxLength: iLength || 0,
                editable: bEditable,
                width: oFieldConfig.sDefaultWidth
            });

        },

        _createDateField: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new DatePicker({
                id: sFieldId,
                value: sDisplayValue,
                editable: oFieldConfig.editable,
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd",
                width: "14rem",

            });
        },

        _createTextAreaField: function (sFieldId, sDisplayValue, oFieldConfig) {
            const iLength = parseInt(oFieldConfig.length, 10) || 0;
            const bEditable = oFieldConfig.editable !== false;

            if (iLength > 0 && iLength <= 200) {
                // Input para textos cortos
                return new sap.m.Input({
                    id: sFieldId,
                    maxLength: iLength,
                    type: sap.m.InputType.Text,
                    width: `${Math.min(iLength, 40) * 0.9}rem`,
                    value: sDisplayValue,
                    editable: bEditable
                });
            }

            // TextArea para textos largos
            return new sap.m.TextArea({
                id: sFieldId,
                value: sDisplayValue,
                rows: 3,
                maxLength: iLength || 0,
                editable: bEditable,
                width: oFieldConfig.sDefaultWidth
            });
        },


        _createURLField: function (sFieldId, sDisplayValue, bEditable, textoUrl) {

            if (bEditable) {
                const sEditableValue = (sDisplayValue && typeof sDisplayValue === 'object') ? sDisplayValue.uri : sDisplayValue;
                return new Input({
                    id: sFieldId,
                    value: sEditableValue || "",
                    type: sap.m.InputType.Url,
                    editable: true
                });
            }

            else {
                const sUrl = (sDisplayValue && typeof sDisplayValue === 'object' && sDisplayValue.uri)
                    ? sDisplayValue.uri
                    : (typeof sDisplayValue === 'string' ? sDisplayValue : "");

                if (sUrl && sUrl !== "(Vacío)") {
                    return new sap.m.Link({
                        id: sFieldId,
                        text: textoUrl,
                        href: sUrl,
                        target: "_blank",
                        wrapping: true
                    });
                }
                else {
                    return new sap.m.Text({
                        id: sFieldId,
                        text: "—"
                    });
                }
            }
        },

        _createInputDecimal: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new Input({
                id: sFieldId,
                value: oFieldConfig.cust_value ?? oFieldConfig.realValue ?? "",
                maxLength: Number(oFieldConfig.length) || 15,
                width: oFieldConfig.sDefaultWidth,
                editable: oFieldConfig.editable,
                liveChange: (oEvent) => {
                    const oInput = oEvent.getSource();
                    let sValue = oInput.getValue();
                    let sOriginalValue = sValue;
                    let sFilteredValue = sValue.replace(/[^0-9,]/g, '');  // 1. Limpiar todo excepto números y comas

                    // 2. No debe empezar con coma
                    if (sFilteredValue.startsWith(',')) {
                        // Elimina la coma del inicio
                        sFilteredValue = sFilteredValue.substring(1);
                    }
                    // 3. No debe tener comas seguidas (ej. '1,,2')    
                    while (sFilteredValue.includes(',,')) {
                        sFilteredValue = sFilteredValue.replace(/,,/g, ',');
                    }
                    // 4. Actualizar el valor en el input solo si ha cambiado
                    if (sOriginalValue !== sFilteredValue) {
                        oInput.setValue(sFilteredValue);
                    }
                }
            });

        },

        _createInputNumber: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new Input({
                id: sFieldId,
                value: sDisplayValue,
                editable: oFieldConfig.editable,
                enabled: true,
                maxLength: Number(oFieldConfig.length) || 100,
                width: oFieldConfig.length ? `${oFieldConfig.length}rem` : undefined,
                liveChange: (oEvent) => oEvent.getSource().setValue(oEvent.getParameter("value").replace(/[^0-9]/g, ''))
            });
        },

        _createTimePicker: function (sFieldId, sDisplayValue, oFieldConfig) {
            return new sap.m.TimePicker({
                id: sFieldId,
                valueFormat: "HH:mm:ss",
                displayFormat: "hh:mm a",
                width: "14rem",
                value: sDisplayValue,
                editable: oFieldConfig.editable
            });

        },

        _checkIfAnyFieldIsEditable: function (aAttachmentFields, bEditMode, oSolicitud, bUsuarioEsCreador) {
            return aAttachmentFields.some(oField => {
                let bEditable = oField.cust_modif === true && bEditMode && oSolicitud.cust_status === "RA";
                if (bUsuarioEsCreador && !oField.cust_ModificablePEmpleado) {
                    bEditable = false;
                }
                return bEditable;
            });
        },

        _loadAllGroupedAttachments: async function (aAttachmentFields, bCanDelete) {
            const aAllAttachments = [];
            const oModel = this._oController.getOwnerComponent().getModel();

            for (const oAttField of aAttachmentFields) {
                const sCustValue = oAttField.cust_value;

                if (sCustValue && sCustValue.trim() !== "") {
                    const aFilter = [new Filter("attachmentId", FilterOperator.EQ, sCustValue)];

                    try {
                        const data = await Service.readDataERP("/Attachment", oModel, aFilter);

                        if (data?.data?.results?.length) {
                            data.data.results.forEach(oAttachment => {
                                aAllAttachments.push({
                                    fileName: oAttachment.fileName,
                                    mediaType: oAttachment.mimeType,
                                    fileSize: oAttachment.fileSize || 0,
                                    url: this._crearDataURI(oAttachment.mimeType, oAttachment.fileContent),
                                    fileContent: oAttachment.fileContent,
                                    attachmentId: oAttachment.attachmentId,
                                    fileId: oAttachment.fileId,
                                    fieldExternalCode: oAttField.externalCode,
                                    isExisting: true,
                                    canDelete: bCanDelete
                                });
                            });
                        }
                    } catch (error) {
                        console.error("Error cargando attachments:", error);
                        MessageBox.error("Error al cargar los adjuntos: " + error.message);
                    }
                }
            }

            return aAllAttachments;
        },

        _onGroupedFilesSelected: function (oEvent, oFileUploader, oTable, oModel) {
            const aFiles = oEvent.getParameter("files");

            if (!aFiles || aFiles.length === 0) {
                return;
            }

            const aItems = oModel.getProperty("/items");
            const aPending = oModel.getProperty("/pendingFiles");
            const iMaxSize = 10 * 1024 * 1024; // 10MB

            let iProcessedFiles = 0;
            const iTotalFiles = aFiles.length;

            for (let i = 0; i < aFiles.length; i++) {
                const oFile = aFiles[i];

                // Validar tamaño
                if (oFile.size > iMaxSize) {
                    MessageToast.show(`${this.oResourceBundle.getText("veryLargeFile")} (${oFile.name})`);
                    continue;
                }

                // Leer el archivo
                const oReader = new FileReader();
                oReader.onload = (e) => {
                    const sBase64Content = e.target.result.split(",")[1];

                    const oNewFile = {
                        nombre: oFile.name,
                        contenido: sBase64Content,
                        mimeType: oFile.type,
                        size: oFile.size,
                        tempId: Date.now() + "_" + i
                    };

                    // Agregar a items visibles
                    const oNewItem = {
                        fileName: oFile.name,
                        mediaType: oFile.type,
                        fileSize: oFile.size,
                        url: null,
                        isExisting: false,
                        canDelete: true,
                        tempId: oNewFile.tempId
                    };

                    aItems.push(oNewItem);
                    aPending.push(oNewFile);

                    oModel.setProperty("/items", aItems);
                    oModel.setProperty("/pendingFiles", aPending);

                    iProcessedFiles++;
                    if (iProcessedFiles === iTotalFiles) {
                        const sMessage = iTotalFiles === 1
                            ? this.oResourceBundle.getText("fileReadyToBeSaved")
                            : (this.oResourceBundle.getText("filesReadyToBeSaved")).replace("{0}", iTotalFiles);
                        MessageToast.show(sMessage);
                    }
                };

                oReader.readAsDataURL(oFile);
            }
            oFileUploader.clear();
        },

        _onDeleteGroupedAttachment: function (oEvent, oTable, oModel) {
            let that = this;
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("attachments");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop());
            const aItems = oModel.getProperty("/items");
            const oItemData = aItems[iIndex];

            if (!oItemData) {
                return;
            }

            const oDialogModel = new JSONModel({
                icon: "sap-icon://message-information",
                type: this.oResourceBundle.getText("confirmDelete"),
                state: "Information",
                message: this.oResourceBundle.getText("deleteFile", [oItemData.fileName]),
                acceptText: this.oResourceBundle.getText("delete"),
                cancelText: this.oResourceBundle.getText("cancel"),
                showAddCommentLink: false
            });

            DialogManager.open(this._oMainView, oDialogModel, {
                onAccept: function () {
                    if (oItemData.isExisting) {
                        const aDeleted = oModel.getProperty("/deletedAttachments");
                        aDeleted.push(oItemData);
                        oModel.setProperty("/deletedAttachments", aDeleted);
                    } else {
                        // Si es un archivo pendiente, eliminarlo de pendientes
                        const aPending = oModel.getProperty("/pendingFiles");
                        const iPendingIndex = aPending.findIndex(p => p.tempId === oItemData.tempId);
                        if (iPendingIndex > -1) {
                            aPending.splice(iPendingIndex, 1);
                            oModel.setProperty("/pendingFiles", aPending);
                        }
                    }
                    // Remover del modelo
                    aItems.splice(iIndex, 1);
                    oModel.setProperty("/items", aItems);

                    const iCount = aItems.length;
                    that._oPanel.setHeaderText(`${that.oResourceBundle.getText("attachments")} (${iCount})`);
                    MessageToast.show(that.oResourceBundle.getText("fileDeletedSuccessfully"));
                },
                onCancel: function () {
                    console.log("Guardado cancelado por el usuario");
                }
            }).catch(function (error) {
                console.log("Guardado cancelado por el usuario");
            });

        },

        _crearDataURI: function (sMimeType, sBase64) {
            return "data:" + sMimeType + ";base64," + sBase64;
        },

        _onCancelRequest: function (oSolicitud, oDetailView) {
            var that = this;

            if (!this._oController || !this._oController.onCancelarSolicitudFromDetail) {
                return;
            }

            const oDialogModel = new JSONModel({
                icon: "sap-icon://message-warning",
                type: this.oResourceBundle.getText("confirmCancel"),
                state: "Warning",
                message: this.oResourceBundle.getText("cancelRequestConfirmation", [oSolicitud.cust_nombreSol]),
                acceptText: this.oResourceBundle.getText("aceptar"),
                cancelText: this.oResourceBundle.getText("cancel"),
                showAddCommentLink: true
            });

            DialogManager.open(this._oMainView, oDialogModel, {
                onAccept: function (sComment) {
                    that._oController.onCancelarSolicitudFromDetail(
                        oSolicitud.cust_nombreSol,
                        oSolicitud.externalCode,
                        sComment
                    ).then(function (bWasCancelled) {
                        if (bWasCancelled) {
                            MessageToast.show(that.oResourceBundle.getText("requestCancelled"));
                            setTimeout(function () {
                                that._onBackToMain(oDetailView);
                            }, 500);
                        }
                    }).catch(function (error) {
                        MessageToast.show("Error al procesar la cancelación: " + error);
                        Util.showBI(false);
                    });
                },
                onCancel: function () {
                    console.log("Cancelación de solicitud abortada por el usuario");
                }
            }).catch(function (error) {
                console.log("Cancelación de solicitud abortada por el usuario");
            });
        },

        /**
         * Navegar a vista de detalle
         */
        _navigateToDetailView: function (oDetailView) {
            var oApp = this._oMainView.getParent();
            oApp.addPage(oDetailView);
            oApp.to(oDetailView.getId());
        },

        /**
         * Volver a la vista principal
         */
        _onBackToMain: function (oDetailView) {
            var oApp = this._oMainView.getParent();

            // Volver
            oApp.back();

            this._fieldControlsMap = null;
            this._oCurrentDetailView = null;

            // Limpiar memoria
            setTimeout(function () {
                if (oDetailView) {
                    oApp.removePage(oDetailView);
                    oDetailView.destroy();
                }
            }, 500);
        },

        _validateDateRange: function () {
            let oFechaInicio = null;
            let oFechaFin = null;
            let oControlInicio = null;
            let oControlFin = null;

            // Buscar los controles de fechas
            for (const field of this._dynamicFields) {
                if (field.cust_field === "cust_Data_inici") {
                    oControlInicio = this._fieldControlsMap[field.externalCode];
                    if (oControlInicio && oControlInicio.getValue) {
                        oFechaInicio = oControlInicio.getValue();
                    }
                }
                if (field.cust_field === "cust_Data_caducitat") {
                    oControlFin = this._fieldControlsMap[field.externalCode];
                    if (oControlFin && oControlFin.getValue) {
                        oFechaFin = oControlFin.getValue();
                    }
                }
            }

            // Validar fechas
            if (oFechaInicio && oFechaFin) {
                const dFechaInicio = new Date(oFechaInicio);
                const dFechaFin = new Date(oFechaFin);

                if (dFechaFin < dFechaInicio) {
                    if (oControlInicio && typeof oControlInicio.setValueState === "function") {
                        oControlInicio.setValueState(ValueState.Error);
                        oControlInicio.setValueStateText(this.oResourceBundle.getText("validation.dateIni"));
                    }
                    if (oControlFin && typeof oControlFin.setValueState === "function") {
                        oControlFin.setValueState(ValueState.Error);
                        oControlFin.setValueStateText(this.oResourceBundle.getText("validation.dateEnd"));
                    }
                    return false;
                }
            }

            return true;
        },

        _validateDeclaraciones: function () {
            let bValidacionCorrecta = true;
            const aCamposDeclaracion = ["cust_Cesion_datos2", "cust_declaro1", "cust_declaro2", "cust_Declaro"];

            for (const field of this._dynamicFields) {

                if (aCamposDeclaracion.includes(field.cust_field)) {
                    const oControl = this._fieldControlsMap[field.externalCode];
                    const sValorSeleccionado = oControl?.getSelectedKey?.();

                    if (sValorSeleccionado === "1662") {
                        bValidacionCorrecta = false;

                        if (oControl?.setValueState) {
                            oControl.setValueState(ValueState.Error);

                            let sTextoError = "";
                            switch (field.cust_field) {
                                case "cust_Cesion_datos2":
                                    sTextoError = this.oResourceBundle.getText("validation.cesionDatos");
                                    break;
                                case "cust_declaro1":
                                    sTextoError = this.oResourceBundle.getText("validation.telework");
                                    break;
                                case "cust_declaro2":
                                    sTextoError = this.oResourceBundle.getText("validation.telework");
                                    break;
                                case "cust_Declaro":
                                    sTextoError = this.oResourceBundle.getText("validation.responsability");
                                    break;
                            }

                            oControl.setValueStateText(sTextoError);
                        }
                    } else {

                        if (oControl?.setValueState) {
                            oControl.setValueState(ValueState.None);
                            oControl.setValueStateText("");
                        }
                    }
                }
            }

            return bValidacionCorrecta;
        },

        validateForm: function () {
            let bFormularioValido = true;
            const user = this._oController.oCurrentUser.name;
            const bUsuarioEsCreador = (user === this._oSolicitud.createdBy);

            // Limpiar estados de error anteriores
            this._dynamicFields.forEach(function (field) {
                const oControl = this._fieldControlsMap[field.externalCode];
                if (oControl) {
                    if (typeof oControl.setValueState === "function") {
                        oControl.setValueState(ValueState.None);
                    }
                    if (field.cust_fieldtype === "A" && oControl.hasStyleClass("campoAdjuntoError")) {
                        oControl.removeStyleClass("campoAdjuntoError");
                    }
                }
            }.bind(this));

            // Validar campos normales
            for (const field of this._dynamicFields) {

                if (field.cust_fieldtype === "A" && this._groupedAttachmentsData) {
                    continue;
                }

                let bDebeValidarse = !!field.cust_mandatory;

                if (bUsuarioEsCreador && !field.cust_ModificablePEmpleado) {
                    bDebeValidarse = false;
                }

                if (bDebeValidarse) {
                    const oControl = this._fieldControlsMap[field.externalCode];
                    if (!oControl) continue;

                    let bCampoValido = false;

                    switch (field.cust_fieldtype) {
                        case "A":

                            const aCurrentItems = oControl.getItems ? oControl.getItems() : [];
                            const aPendingFiles = oControl.data("pendingFiles") || [];
                            const iExistingFiles = aCurrentItems.filter(function (item) {
                                return !item.data("isNewFile");
                            }).length;
                            const iNewFiles = aPendingFiles.length;
                            const iTotalFiles = iExistingFiles + iNewFiles;
                            bCampoValido = iTotalFiles > 0;
                            break;

                        case "P":
                            if (oControl.getSelectedKey && oControl.getSelectedKey()) bCampoValido = true;
                            break;

                        default:
                            if (oControl.getValue && oControl.getValue().trim() !== "") bCampoValido = true;
                            break;
                    }

                    if (!bCampoValido) {
                        bFormularioValido = false;
                        if (field.cust_fieldtype === "A") {
                            oControl.addStyleClass("campoAdjuntoError");
                        } else if (typeof oControl.setValueState === "function") {
                            oControl.setValueState(ValueState.Error);
                        }
                    }
                }
            }

            // Validar tabla agrupada de attachments (SI EXISTE)
            if (this._groupedAttachmentsData) {
                const aAttachmentFields = this._groupedAttachmentsData.attachmentFields || [];
                const bHayAlgunCampoObligatorio = aAttachmentFields.some(f => {
                    let bEsObligatorio = !!f.cust_mandatory;
                    if (bUsuarioEsCreador && !f.cust_ModificablePEmpleado) {
                        bEsObligatorio = false;
                    }
                    return bEsObligatorio;
                });

                if (bHayAlgunCampoObligatorio) {
                    const oModel = this._groupedAttachmentsData.model;
                    const aItems = oModel.getProperty("/items") || [];

                    if (aItems.length === 0) {
                        bFormularioValido = false;
                        // Marcar visualmente el panel como error
                        const oPanel = this._groupedAttachmentsData.panel;
                        if (oPanel) {
                            oPanel.addStyleClass("sapUiFormFieldError");
                        }
                        MessageToast.show(this.oResourceBundle.getText("validation.attachmentRequired"));
                    } else {
                        // Quitar el estilo de error si ya no aplica
                        const oPanel = this._groupedAttachmentsData.panel;
                        if (oPanel && oPanel.hasStyleClass("sapUiFormFieldError")) {
                            oPanel.removeStyleClass("sapUiFormFieldError");
                        }
                    }
                }
            }

            if (bFormularioValido && !this._validateDateRange()) {
                bFormularioValido = false;
            }

            if (bFormularioValido && !this._validateDeclaraciones()) {
                bFormularioValido = false;
            }

            return bFormularioValido;
        },
    });
});