sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/BusyIndicator",

], function (MessageBox, MessageToast, BusyIndicator) {
	"use srtict";

	return {
		console: console,
		styleClass: "sapUiSizeCompact",

		onShowMessage: function (_message, _type, _fnCallback, _oProperties) {
			let oProperties = {
				styleClass: this.styleClass
			};
			if (_oProperties !== undefined && _oProperties !== null) {
				oProperties = _oProperties;
			}
			if (_fnCallback !== undefined && _fnCallback !== null) {
				oProperties.onClose = _fnCallback;
			}
			try {
				if (_message !== undefined && _type !== undefined) {
					switch (_type) {
						case "info":
							MessageBox.information(_message, oProperties);
							break;
						case "error":
							MessageBox.error(_message, oProperties);
							break;
						case "warn":
							MessageBox.warning(_message, oProperties);
							break;
						case "toast":
							MessageToast.show(_message);
							break;
						case "done":
							MessageBox.success(_message, oProperties);
							break;
					}
				} else {
					this.console.warn("_message or _type are undefined");
				}
			} catch (err) {
				this.console.warn(err.stack);
			}
		},

		showBI: function (value) {
			if (value) {
				BusyIndicator.show(0);
			} else {
				BusyIndicator.hide();
			}
		},

		refreshXsuaaToken: async function () {
			try {
				const response = await fetch("/oauth/token", {
					method: "GET",
					credentials: "include"
				});
				if (response.ok) {
					console.log("Token renovado correctamente");
					return true;
				}
				console.warn("No se pudo renovar el token", response.status);
				return false;
			} catch (err) {
				console.error("Error al intentar refrescar token:", err);
				return false;
			}
		},

		onRequestFailed: async function (oEvent) {
			const oParams = oEvent.getParameters();
			const sStatusCode = oParams.response.statusCode;
			let oResourceBundle = null;

			if (this.oView) {
				oResourceBundle = this.oView.getOwnerComponent().getModel("i18n").getResourceBundle();
			}

			if (sStatusCode === 401 || sStatusCode === 403) {
				const refreshed = await this.refreshXsuaaToken();
				if (refreshed) {
					MessageToast.show(oResourceBundle.getText("sessionRenewed"));
					return; // ya se refrescó el token, no hace falta recargar
				} else {
					MessageToast.show(oResourceBundle.getText("sessionExpired"));
					window.location.reload(true);
				}
			}
		},

		getModelMainAndValidateSession: function (oView) {
            this.oView = oView;
            const oMainModel = oView.getOwnerComponent().getModel();
            if(oMainModel){
                oMainModel.attachRequestFailed(this.onRequestFailed, this);
            }
        }

	};
});