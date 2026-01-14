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
        },

		getMapaBuzones: function() {
			const MAPA = {
				// Catalán
				"Acció social": "recursoshumans@amb.cat",
				"Formació": "formacio@amb.cat",
				"Gestió de personal": "recursoshumans@amb.cat",
				"Nòmina": "nomines@amb.cat",
				
				// Español
				"Acción social": "recursoshumans@amb.cat",
				"Formación": "formacio@amb.cat",
				"Gestión de personal": "recursoshumans@amb.cat",
				"Nómina": "nomines@amb.cat",
				
				// Inglés
				"Social Action": "recursoshumans@amb.cat",
				"Training": "formacio@amb.cat",
				"Personnel Management": "recursoshumans@amb.cat",
				"Payroll": "nomines@amb.cat",
				
				// Común en todos los idiomas
				"PRL": "prevencio@amb.cat"
			};
			
			return MAPA;
		},

		getMailByStep: function(sPasoActual) {
			if(!sPasoActual) {
				return null;
			}
			
			const oMapaBuzones = this.getMapaBuzones();
			const sPasoNormalizado = sPasoActual.toLowerCase().trim();
			
			// Buscar coincidencia exacta primero
			if(oMapaBuzones[sPasoActual]) {
				return oMapaBuzones[sPasoActual];
			}
			
			// Si no, buscar ignorando mayúsculas
			for(let key in oMapaBuzones) {
				if(key.toLowerCase().trim() === sPasoNormalizado) {
					return oMapaBuzones[key];
				}
			}
			
			return null;
		},

		getEmailValido: function(oUsuario) {
			if(!oUsuario) {
				return null;
			}
			
			const rEmailValidator = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;			
		
			if (oUsuario.email && typeof oUsuario.email === 'string' && rEmailValidator.test(oUsuario.email.trim())) {
				return oUsuario.email.trim();
			}			
			
			if (oUsuario.username && typeof oUsuario.username === 'string' && rEmailValidator.test(oUsuario.username.trim())) {
				return oUsuario.username.trim();
			}
			
			return null;
		},

	};
});