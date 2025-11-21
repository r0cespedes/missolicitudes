sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "com/inetum/missolicitudes/model/models",
    "./Utils/Util",
], (UIComponent, JSONModel, models, Util) => {
    "use strict";

    return UIComponent.extend("com.inetum.missolicitudes.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();

            if (String(sessionStorage.getItem("com:missolicitudes:userInfo")) !== "null") {
                const oModelUser = new JSONModel(JSON.parse(sessionStorage.getItem("com:missolicitudes:userInfo")))
                this.setModel(oModelUser, "userModel");
            }
            if (this.getModel("userModel")) {
                sessionStorage.removeItem("com:missolicitudes:userInfo")
            }
            const oMainModel = this.getModel(); // Obtiene el modelo OData V2 principal
            if (oMainModel) {
                oMainModel.attachRequestFailed(Util.onRequestFailed, this);
            }

        }
    });
});