sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",  
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../dinamic/DinamicFields",
    "../service/Service",
    "../model/formatter",
    "../Utils/Util",
    "../Utils/DialogManager",

], function (Controller, JSONModel, Filter, FilterOperator, DinamicFields, Service, formatter, Util, DialogManager) {
    "use strict";

    return Controller.extend("com.inetum.missolicitudes.controller.Main", {
        formatter: formatter,

        onInit: function () {

            this.loadCurrentUser();
            this.oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            //Pasar la referencia del controlador
            this._oDinamicFields = new DinamicFields(this);
        },


        loadCurrentUser: async function () {
            await Util.getModelMainAndValidateSession(this);
            const sUrl = sap.ui.require.toUrl("com/inetum/missolicitudes") + "/user-api/currentUser";
        
            fetch(sUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => this._setUserModel(data))
                .catch(error => {
                    console.error("Error obteniendo usuario:", error);
                    this._setUserModel({
                        displayName: '',
                        email: '',
                        firstname: '',
                        lastname: '',
                        name: ''
                    });
                });
        },

        _setUserModel: async function (userData) {
            var oViewUserModel = new sap.ui.model.json.JSONModel([{
                "displayName": userData.displayName || '',
                "email": userData.email || '',
                "firstname": userData.firstname || '',
                "lastname": userData.lastname || '',
                "name": userData.name || ''
            }]);

            this.getView().setModel(oViewUserModel, "oModelUser");
            sap.ui.getCore().setModel(oViewUserModel, "oModelUser");
            sessionStorage.setItem("displayName", oViewUserModel.getProperty("/0/name"));
            this.oCurrentUser = oViewUserModel.getData()[0];
            await this._loadAndSetUserModel();
            await this.onGetDM001();
            
        },


        /**
        * Con la entidad cust_INETUM_SOL_DM_0002 y expand createdByNav recupero nombre usuario, correo, Id
        */

        onGetDM001: async function () {
            await Util.getModelMainAndValidateSession(this);
            var oTable = this.byId("idRequestTable");
            oTable.setShowNoData(false);
            Util.showBI(true);

            try {
                const oModel = this.getOwnerComponent().getModel();

                // Consulta a DM_0001
                const oMyRequestsPromise = Service.readDataERP(
                    "/cust_INETUM_SOL_DM_0001",
                    oModel,
                    [
                        new Filter("createdBy", FilterOperator.EQ, this.oCurrentUser.name)
                    ],
                    {
                        bParam: true,
                        oParameter: { "$expand": "cust_steps,cust_solFields/cust_fieldtypeNav" }
                    }
                );

                // Consulta a pendientes de editar
                const oPendingRequestsPromise = this._getRequestsPendingEdit();

                //Se ejecutan las dos promesas de las consultas
                const [oMyRequestsResult, aPendingRequests] = await Promise.all([
                    oMyRequestsPromise,
                    oPendingRequestsPromise
                ]);

                const aMyRequests = oMyRequestsResult.data?.results ?? [];
                const oCombinedRequests = new Map();

                aMyRequests.forEach(request => oCombinedRequests.set(request.externalCode, request));
                aPendingRequests.forEach(request => oCombinedRequests.set(request.externalCode, request));

                const aFinalRequests = Array.from(oCombinedRequests.values());


                // Formateo de fecha y status de la lista final y unificada
                aFinalRequests.forEach(item => {
                    item.cust_status_Str = formatter.formatNameStatus(item.cust_status);
                    item.cust_fechaSol_Str = formatter.formatDate(item.cust_fechaSol);
                });

                // Creación del modelo JSON con la data final
                const oSolicitudesModel = new JSONModel({
                    solicitudes: {
                        results: aFinalRequests,
                        totalCount: aFinalRequests.length
                    }
                });
                this.getView().setModel(oSolicitudesModel, "solicitudes");

                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    var oSorter = new sap.ui.model.Sorter("cust_fechaSol", true); // true for descending
                    oBinding.sort(oSorter);
                }

            } catch (error) {
                Util.onShowMessage("Error al cargar solicitudes: " + (error.message || error), 'error');
            } finally {
                oTable.setBusy(false);
                oTable.setShowNoData(true);
                Util.showBI(false);
            }
        },

        /**
         * Obtiene las solicitudes que el usuario actual tiene pendientes por editar.
         * Consulta DM_0002 para encontrar los pasos activos del usuario.
         * Usa las claves obtenidas para buscar los detalles en DM_0001 en un solo batch.
         */
        _getRequestsPendingEdit: function () {
            return new Promise(async (resolve, reject) => {
                const oModel = this.getOwnerComponent().getModel();
                const sUserOnLine = this.oCurrentUser.name;

                const oParametersDM0002 = {
                    bParam: true,
                    oParameter: {
                        "$select": "cust_INETUM_SOL_DM_0001_externalCode,cust_INETUM_SOL_DM_0001_effectiveStartDate",
                        "$filter": `cust_aprobUser eq '${sUserOnLine}' and cust_activeStep eq true`
                    }
                };

                const oDataDm0002 = await Service.readDataERP("/cust_INETUM_SOL_DM_0002", oModel, [], oParametersDM0002);
                const aRequestKeys = oDataDm0002.data?.results ?? [];

                if (aRequestKeys.length === 0) {
                    resolve([]);
                    return;
                }

                // Consulta de DM_0001 usando las claves 
                const GROUP_ID = "pendingEditBatch";
                oModel.setDeferredGroups([GROUP_ID]);
                const aPendingRequests = [];

                aRequestKeys.forEach(key => {
                    const sPath = oModel.createKey('/cust_INETUM_SOL_DM_0001', {
                        effectiveStartDate: key.cust_INETUM_SOL_DM_0001_effectiveStartDate,
                        externalCode: key.cust_INETUM_SOL_DM_0001_externalCode
                    });

                    oModel.read(sPath, {
                        urlParameters: { "$expand": "cust_steps,cust_solFields/cust_fieldtypeNav" },
                        groupId: GROUP_ID,
                        success: (data) => {
                            // Se añaden las que están pendientes de editar
                            if (data && data.cust_status === 'RA') {
                                aPendingRequests.push(data);
                            }
                        },
                        error: (err) => console.error("Error en batch read:", err)
                    });
                });

                oModel.submitChanges({
                    groupId: GROUP_ID,
                    success: () => {
                        resolve(aPendingRequests);
                    },
                    error: (oError) => {
                        console.error("Error al enviar el batch:", oError);
                        reject(oError);
                    }
                });
            });
        },

        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query");
            var oTable = this.byId("idRequestTable");
            var oBinding = oTable.getBinding("rows");

            if (sQuery) {
                var aFilters = [
                    new sap.ui.model.Filter("cust_nombreSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("cust_nombreTSol", sap.ui.model.FilterOperator.Contains, sQuery),
                    new sap.ui.model.Filter("cust_fechaSol_Str", sap.ui.model.FilterOperator.Contains, sQuery)
                ];
                var oMainFilter = new sap.ui.model.Filter(aFilters, false);
                oBinding.filter([oMainFilter]);
            } else {
                oBinding.filter([]);
                this.clearAllFlters();
            }
            this._updateTableCount()
        },

        clearAllFlters: function () {
            var oTable = this.byId("idRequestTable");

            oTable.getBinding()?.sort(null);
            var oUiModel = this.getView().getModel("mLocalModel");
            oUiModel.setProperty("/globalFilter", "");
            oUiModel.setProperty("/availabilityFilterOn", false);

            var aColumns = oTable.getColumns();
            for (var i = 0; i < aColumns.length; i++) {
                oTable.filter(aColumns[i], null);
            }

            this._resetSortingState();

        },
        /**
         * Quita el ordenamiento de cada columna en la tabla  
        **/
        _resetSortingState: function () {
            var oTable = this.byId("idRequestTable");
            var aColumns = oTable.getColumns();
            for (var i = 0; i < aColumns.length; i++) {
                aColumns[i].setSorted(false);
            }
        },

        /**
        * Actualiza la cantidad de registros de la tabla  
       **/
        _updateTableCount: function () {
            var oTable = this.byId("idRequestTable");
            var oBinding = oTable.getBinding("rows");

            if (oBinding) {
                let iFilteredCount = oBinding.getLength();
                this.getView().getModel("solicitudes").setProperty("/solicitudes/totalCount", iFilteredCount);
            }
        },


        onVisualizarPress: function (oEvent) {
            Util.showBI(true);
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode, false);
        },

        onEditarPress: function (oEvent) {
            Util.showBI(true);
            var oContext = oEvent.getSource().getBindingContext("solicitudes");
            var oSolicitud = oContext.getObject();

            if (oSolicitud.cust_status === "RA") {
                this._oDinamicFields.showDynamicDetailView(oSolicitud.externalCode, true);
            }
        },

        /**
         * Cancelar solicitud desde la tabla principal
         */
        onCancelarPress: async function (oEvent) {
            // Guardar el contexto y datos para usarlos después
            this._oCurrentContext = oEvent.getSource().getBindingContext("solicitudes");
            this._oSolicitudCompleta = this._oCurrentContext.getObject();
            this._sSolicitudId = this._oCurrentContext.getProperty("cust_nombreSol");

            // Configurar el modelo del dialog
            const oDialogModel = new JSONModel({
                icon: "sap-icon://message-warning",
                type: this.oResourceBundle.getText("confirmCancel"),
                state: "Warning",
                message: this.oResourceBundle.getText("cancelRequestConfirmation", [this._sSolicitudId]),
                acceptText: this.oResourceBundle.getText("save"),
                cancelText: this.oResourceBundle.getText("cancel"),
                showAddCommentLink: true
            });

            try {
                const result = await DialogManager.open(this.getView(), oDialogModel, {
                    onAccept: this.onConfirmCancelacion.bind(this),
                    onCancel: this.onCancelComment.bind(this)
                });
                
                console.log("Dialog aceptado:", result.comment);
            } catch (error) {
                console.log("Dialog cancelado o cerrado");
            }
        },

        onToggleComment: function () {
            const oTextArea = this.byId("commentTextArea");
            if (oTextArea) {
                oTextArea.setVisible(!oTextArea.getVisible());
                if (oTextArea.getVisible()) {
                    oTextArea.focus();
                }
            }
        },

        onConfirmCancelacion: function () {
            // Obtener el comentario si existe
            const oTextArea = this.byId("commentTextArea");
            const sComment = oTextArea && oTextArea.getVisible() ? oTextArea.getValue() : "";

            this.byId("commentDialog").close();

            this._oCurrentContext.getModel().setProperty(
                this._oCurrentContext.getPath() + "/cust_status",
                "Cancelado"
            );

            // Guardar el comentario si existe 
            if (sComment && sComment.trim() !== "") {
                this._oCurrentContext.getModel().setProperty(
                    this._oCurrentContext.getPath() + "/cust_comentario",
                    sComment
                );
            }

            // Cambiar el status
            this.onChangeStatus(this._oSolicitudCompleta);

            Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel"), "toast");
            // Actualizar la tabla
            var oTable = this.byId("idRequestTable");
            oTable.getModel("solicitudes").refresh();

            // Limpiar variables
            this._oCurrentContext = null;
            this._oSolicitudCompleta = null;
            this._sSolicitudId = null;
        },

        // Handler para el botón Cancelar del Dialog
        onCancelComment: function () {
            // Limpiar y cerrar el dialog
            const oTextArea = this.byId("commentTextArea");
            if (oTextArea) {
                oTextArea.setValue("");
                oTextArea.setVisible(false);
            }
            this.byId("commentDialog").close();

            // Limpiar variables
            this._oCurrentContext = null;
            this._oSolicitudCompleta = null;
            this._sSolicitudId = null;
        },

        /**
         * Cancelar solicitud desde el dialog de detalles
         * Esta función será llamada desde DinamicFields
         * Retorna una Promise para manejar la respuesta asíncrona
         */
        onCancelarSolicitudFromDetail: function (sNombreSol, sSolicitudId, sComment) {
            var that = this;
            
            return new Promise(function (resolve, reject) {
                try {         
                    var bSuccess = that._cancelarSolicitudById(sSolicitudId, sComment);                    
                    if (bSuccess) {                     
                        setTimeout(function () {
                            that.onGetDM001();
                        }, 800);                        
                        resolve(true);
                    } else {
                        reject(new Error("No se pudo cancelar la solicitud"));
                    }
                } catch (error) {
                    console.error("Error al cancelar solicitud:", error);
                    reject(error);
                }
            });
        },

        /**
         * Cancelar solicitud por ID - función auxiliar
         */
        _cancelarSolicitudById: function (sSolicitudId) {
            var oModel = this.getView().getModel("solicitudes");
            var aSolicitudes = oModel.getProperty("/solicitudes/results");
            var iIndex = aSolicitudes.findIndex(function (item) {
                return item.externalCode === sSolicitudId;
            });

            if (iIndex >= 0) {
                var oSolicitudCompleta = aSolicitudes[iIndex];
                oModel.setProperty("/solicitudes/results/" + iIndex + "/cust_status", "Cancelado");
                this.onChangeStatus(oSolicitudCompleta);        
                oModel.refresh(sSolicitudId);
                return true;
            }
            return false;
        },

        onChangeStatus: async function (oSolicitud) {

            const oModel = this.getOwnerComponent().getModel();
            var sEntityPath = this._buildEntityPath(oSolicitud.externalCode, oSolicitud.effectiveStartDate);

            try {

                let oDataToUpdate = {
                    externalCode: oSolicitud.externalCode,
                    cust_status: "CA",
                    effectiveStartDate: formatter._formatEffectiveStartDate(oSolicitud.effectiveStartDate),
                    cust_fechaAct: formatter._formatDateForSAP(new Date()),
                    cust_indexStep: "0"
                }

                oModel.update(sEntityPath, oDataToUpdate, {
                    success: function (oData, oResponse) {
                        console.log("Status actualizado");
                    },
                    error: function (oError) {
                        console.error("Error Actualizar", oError);
                    }
                });

                Util.onShowMessage(this.oResourceBundle.getText("successRequestCancel", [oSolicitud.cust_nombreSol]), "toast");

                await this.onGetDM001();

            } catch (error) {
                Util.onShowMessage("Error " + (error.message || error), 'toast');
                Util.showBI(false);

            } finally {
                Util.showBI(false);
            }

        },

        _buildEntityPath: function (sExternalCode, sEffectiveStartDate) {
            // Formatear effectiveStartDate para la URL
            var sFormattedDate = formatter._formatDateForEntityPath(sEffectiveStartDate);

            // Construir path con clave compuesta
            var sEntityPath = `/cust_INETUM_SOL_DM_0001(effectiveStartDate=datetime'${sFormattedDate}',externalCode='${sExternalCode}')`;

            return sEntityPath;

        },

        onDetectorAdjunto: function (oEvent) {
            const oResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const oFile = oEvent.getParameter("files")[0];
            const oUploadCollection = oEvent.getSource();

            if (!oFile) {
                return;
            }

            if (oFile.type !== "application/pdf") {
                sap.m.MessageBox.error(oResourceBundle.getText("error.fileNotPdf"));
                oUploadCollection.removeAllItems();
                this._archivosParaSubir = null;

                return;
            }

            const oReader = new FileReader();
            oReader.onload = (e) => {
                const sBase64Content = e.target.result.split(",")[1];

                // Guardar para envío posterior
                this._archivosParaSubir = {
                    nombre: oFile.name,
                    contenido: sBase64Content,
                    mimeType: oFile.type
                };

                // Crear el UploadCollectionItem manualmente
                const oItem = new sap.m.UploadCollectionItem({
                    fileName: oFile.name,
                    mimeType: oFile.type,
                    url: "data:" + oFile.type + ";base64," + sBase64Content,
                    thumbnailUrl: "sap-icon://pdf-attachment",
                    enableEdit: false,
                    enableDelete: true
                });

                oUploadCollection.removeAllItems();
                oUploadCollection.addItem(oItem);

                sap.m.MessageToast.show(oResourceBundle.getText("fileReadyToBeSaved"));
            };
            oReader.readAsDataURL(oFile);
        },


        _loadAndSetUserModel: async function () {
            Util.showBI(true);
            const sUserId = this.oCurrentUser.name;

            try {
                const oModelOData = this.getOwnerComponent().getModel();
                const aFilters = [new Filter("userId", FilterOperator.EQ, sUserId)];
                const oUserParams = {
                    bParam: true,
                    oParameter: { "$select": "userId,defaultLocale" }
                };

                const oInfoUser = await Service.readDataERP("/User", oModelOData, aFilters, oUserParams);

                if (oInfoUser.data.results && oInfoUser.data.results.length > 0) {
                    const oFullUserData = oInfoUser.data.results[0];
                    const oUserModel = new JSONModel(oFullUserData);
                    this.getOwnerComponent().setModel(oUserModel, "user");
                    const sLang = oUserModel.oData.defaultLocale;
                    sap.ui.getCore().getConfiguration().setLanguage(sLang);
                } else {
                    console.warn("No se encontraron datos para el usuario:", sUserId);
                }
            } catch (error) {
                console.error("Error al cargar la información del usuario en Main.controller:", error);
            }
        },


    });
});