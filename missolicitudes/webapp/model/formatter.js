sap.ui.define([
    "sap/ui/model/resource/ResourceModel"
], function (ResourceModel) {
    "use strict";

    var oI18nModel = new ResourceModel({
        bundleName: "com.inetum.missolicitudes.i18n.i18n"
    });

    return {

        getI18nText: function (sKey, aArgs) {
            return oI18nModel.getResourceBundle().getText(sKey, aArgs);
        },


        numberUnit: function (sValue) {
            if (!sValue) {
                return "";
            }
            return parseFloat(sValue).toFixed(2);
        },

        formatStatusState: function (sStatus) {
            switch (sStatus) {
                case "EC":
                    return "Warning";
                case "PF":
                    return "Warning";    
                case "CO":
                    return "Success";
                case "CA":
                    return "None";
                case "RA":
                    return "Error";
                default:
                    return "None";
            }
        },

        formatStatusIcon: function (sStatus) {
            switch (sStatus) {
                case "EC":
                    return "sap-icon://pending";
                case "PF":
                    return "sap-icon://pending"    
                case "CO":
                    return "sap-icon://complete";
                case "CA":
                    return "sap-icon://sys-cancel";
                case "RA":
                    return "sap-icon://decline";
                default:
                    return "sap-icon://status-inactive";
            }
        },

        formatNameStatus: function (status) {

            if (status) {
                switch (status) {
                    case "EC":
                        return this.getI18nText("statusInProgress");
                    case "PF":
                        return this.getI18nText("statusInProgress");    
                    case "CO":
                        return this.getI18nText("statusCompleted");
                    case "CA":
                        return this.getI18nText("statusCancelled");
                    case "RA":
                        return this.getI18nText("statusRequiresAction");
                    default:
                        return this.getI18nText("statusUnknown");
                }
            }
        },

        isStatusEnCurso: function (sStatus) {
            return sStatus === "EC" || sStatus === "RA" || sStatus === "PF";
        },

        isStatusRequireAction: function (sStatus) {
            return sStatus === "RA";
        },



        formatDate: function (dateString) {

            if (!dateString || dateString === null || dateString === "null") {
                return "";
            }

            const date = new Date(dateString);

            if (isNaN(date.getTime())) {
                return "";
            }

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const formattedDate = `${day}/${month}/${year}`;

            return formattedDate;
        },

        // Texto en Mayusculas    
        formatUpperCase: function (sValue) {
            return sValue ? sValue.toUpperCase() : "";
        },
        //  texto primera letra en mayuscula
        formatCapitalize: function (sValue) {
            if (!sValue) return "";
            return sValue.charAt(0).toUpperCase() + sValue.slice(1).toLowerCase();
        },

        formatTimeAgo: function (dateValue) {
            if (!dateValue) return "";

            try {

                const date = dateValue instanceof Date ? dateValue : new Date(dateValue);

                // Verificar que la fecha sea válida
                if (isNaN(date.getTime())) {
                    return "";
                }

                const now = new Date();
                const diffInMs = now - date;

                // Si la fecha es futura, manejar diferente
                if (diffInMs < 0) {
                    return "En el futuro";
                }

                const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

                // Solo días en adelante
                if (diffInDays === 0) return "Hoy";
                if (diffInDays === 1) return "Ayer";
                if (diffInDays < 7) return `Hace ${diffInDays} días`;

                // Semanas
                const diffInWeeks = Math.floor(diffInDays / 7);
                if (diffInDays < 30) return `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;

                // Meses
                const diffInMonths = Math.floor(diffInDays / 30);
                if (diffInDays < 365) return `Hace ${diffInMonths} mes${diffInMonths > 1 ? 'es' : ''}`;

                // Años
                const diffInYears = Math.floor(diffInDays / 365);
                return `Hace ${diffInYears} año${diffInYears > 1 ? 's' : ''}`;

            } catch (e) {
                console.error("Error en formatTimeAgo:", e);
                return "";
            }
        },

        _formatDateForSAP: function (dDate) {
            if (!dDate || !(dDate instanceof Date)) {
                return null;
            }

            // Formato SAP: /Date(timestamp)/
            var iTimestamp = dDate.getTime();
            return "/Date(" + iTimestamp + ")/";
        },

        _formatEffectiveStartDate: function (vEffectiveStartDate) {
            // Si ya viene en formato SAP, mantenerlo
            if (typeof vEffectiveStartDate === "string" && vEffectiveStartDate.includes("/Date(")) {
                return vEffectiveStartDate;
            }

            // Si es Date object, convertir a formato SAP
            if (vEffectiveStartDate instanceof Date) {
                return this._formatDateForSAP(vEffectiveStartDate);
            }

            // Si es string de fecha, convertir
            if (typeof vEffectiveStartDate === "string") {
                var dDate = new Date(vEffectiveStartDate);
                return this._formatDateForSAP(dDate);
            }

            // usar fecha actual
            console.warn("effectiveStartDate no válido, usando fecha actual");
            return this._formatDateForSAP(new Date());
        },

        _formatDateForEntityPath: function (vDate) {
            var dDate;

            // Si viene en formato SAP /Date(timestamp)/
            if (typeof vDate === "string" && vDate.includes("/Date(")) {
                var timestamp = vDate.match(/\d+/)[0];
                dDate = new Date(parseInt(timestamp));
            } else if (vDate instanceof Date) {
                dDate = vDate;
            } else if (typeof vDate === "string") {
                dDate = new Date(vDate);
            } else {
                dDate = new Date();
            }

            // Retornar en formato ISO (requerido para EntityPath)
            return dDate.toISOString();
        },

        generarIdNumericoUnico: function () {
            const timestamp = Date.now();
            const randomSuffix = Math.floor(Math.random() * 900) + 100;
            const idNumerico = parseInt(String(timestamp) + String(randomSuffix), 10);
 
            return idNumerico;
        },

        _getFileIcon: function (sMediaType) {
            if (!sMediaType) return "sap-icon://document";

            if (sMediaType.startsWith("image/")) {
                return "sap-icon://card";
            } else if (sMediaType === "application/pdf") {
                return "sap-icon://pdf-attachment";
            }
            return "sap-icon://document";
        },

        _formatFileType: function (sMediaType) {
            if (!sMediaType) return "";

            const oTypes = {
                "application/pdf": "PDF",
                "image/jpeg": "JPEG",
                "image/jpg": "JPG",
                "image/png": "PNG"
            };

            return oTypes[sMediaType] || sMediaType.split("/")[1].toUpperCase();
        },

        _formatFileSize: function (iBytes) {
            if (!iBytes || iBytes === 0) return "0 B";

            const aUnits = ["B", "KB", "MB", "GB"];
            const iUnit = Math.floor(Math.log(iBytes) / Math.log(1024));
            const fSize = iBytes / Math.pow(1024, iUnit);

            return fSize.toFixed(2) + " " + aUnits[iUnit];
        },



    };

});