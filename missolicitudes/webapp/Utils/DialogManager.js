sap.ui.define([
    "sap/ui/core/Fragment"
], function (Fragment) {
    "use strict";

    return {

        
        open: function (oView, oDialogModel, oCallbacks = {}) {
            return new Promise((resolve, reject) => {
                const oDialogController = {
                    onToggleComment: function () {
                        const oTextArea = Fragment.byId(oView.getId(), "commentTextArea");
                        if (oTextArea) {
                            oTextArea.setVisible(!oTextArea.getVisible());
                        }
                    }
                };

                if (!oView.byId("commentDialog")) {
                    Fragment.load({
                        id: oView.getId(),
                        name: "com.inetum.missolicitudes.view.fragment.actionComment",
                        controller: oDialogController
                    }).then(oDialog => {
                        oView.addDependent(oDialog);
                        oDialog.setModel(oDialogModel, "dialogViewModel");
                        this._configureAndOpen(oDialog, oCallbacks, resolve, reject);
                    }).catch(error => {
                        reject(error);
                    });
                } else {
                    const oDialog = oView.byId("commentDialog");
                    oDialog.setModel(oDialogModel, "dialogViewModel");
                    this._configureAndOpen(oDialog, oCallbacks, resolve, reject);
                }
            });
        },

        _configureAndOpen: function (oDialog, oCallbacks, resolve, reject) {
            const oTextArea = oDialog.getContent()[0].getItems().find(c => c.isA("sap.m.TextArea"));
            let bIsResolved = false;
            
            // Limpia el estado del diálogo
            if (oTextArea) {
                oTextArea.setValue("");
                oTextArea.setVisible(false);
            }

            const oAcceptButton = oDialog.getButtons().find(b => b.getId().includes("acceptButton"));
            const oCancelButton = oDialog.getButtons().find(b => b.getId().includes("cancelButton"));

            const fnOnAccept = () => {
                const sComment = oTextArea ? oTextArea.getValue() : "";
                bIsResolved = true;
                oDialog.close();
                
                // Ejecutar callback de aceptación si existe
                if (oCallbacks.onAccept && typeof oCallbacks.onAccept === "function") {
                    oCallbacks.onAccept(sComment);
                }
                
                resolve({ 
                    action: "accept",
                    comment: sComment 
                });
            };

            const fnOnCancel = () => {
                bIsResolved = true;
                oDialog.close();
                
                // Ejecutar callback de cancelación si existe
                if (oCallbacks.onCancel && typeof oCallbacks.onCancel === "function") {
                    oCallbacks.onCancel();
                }
                
                reject({
                    action: "cancel"
                });
            };
            
            const fnAfterClose = () => {
                if (!bIsResolved) {
                    // Si se cierra sin usar los botones (ESC, click fuera, etc.)
                    if (oCallbacks.onCancel && typeof oCallbacks.onCancel === "function") {
                        oCallbacks.onCancel();
                    }
                    reject({
                        action: "dismissed"
                    });
                }
                
                // Limpieza de event handlers
                oAcceptButton.detachPress(fnOnAccept);
                oCancelButton.detachPress(fnOnCancel);
                oDialog.detachAfterClose(fnAfterClose);
            };

            oAcceptButton.attachPress(fnOnAccept);
            oCancelButton.attachPress(fnOnCancel);
            oDialog.attachAfterClose(fnAfterClose);

            oDialog.open();
        }
    };
});