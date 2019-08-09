"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_util_1 = require("./constants.util");
var api_1 = require("../api/api");
var LoginUtil = /** @class */ (function () {
    function LoginUtil() {
    }
    LoginUtil.prototype.loginAsUserWithPasswordChange = function (serviceBaseUrl, username, oldPassword) {
        var authApi = new api_1.AuthApi(username, oldPassword, serviceBaseUrl);
        var userApi = new api_1.UserApi(serviceBaseUrl);
        return authApi.getToken().then(function (response) {
            userApi.setApiKey(api_1.UserApiApiKeys.JwtAuth_, 'Bearer ' + response.body.accessToken);
            var passworChangeItem = {
                oldPassword: oldPassword,
                newPassword: constants_util_1.PASSWORD
            };
            return userApi.changePassword(username, passworChangeItem);
        }).then(function (response) {
            var newAuthApi = new api_1.AuthApi(username, constants_util_1.PASSWORD, serviceBaseUrl);
            return newAuthApi.getToken();
        }).catch(function (e) {
            console.log('loginAsUserWithPasswordChange' + e.response.statusCode, e.response.body);
            throw new Error('API ERROR loginAsUserWithPasswordChange ' + e.response.statusCode + ' ' + e.response.body.Message);
        });
    };
    return LoginUtil;
}());
exports.LoginUtil = LoginUtil;
//# sourceMappingURL=login.util.js.map