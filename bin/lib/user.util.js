"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_util_1 = require("./constants.util");
var api_1 = require("../api/api");
var UserUtil = /** @class */ (function () {
    function UserUtil(serviceBaseUrl) {
        this.keyAcounterRole = 'key_account_manager';
        this.vdcDeviceMakerRole = 'vdc_device_maker';
        this.vdcDeviceProducerRole = 'vdc_device_producer';
        this.vdcDeviceDeveloperRole = 'vdc_device_developer';
        this.firmwareSupplierRole = 'firmware_supplier';
        this.internalAdministratorRole = 'internal_administrator';
        this.mobileSdkSupplier = 'mobile_sdk_supplier';
        this.internalDeveloperRole = 'internal_developer';
        this.internalAdmintranslated = 'Internal administrator';
        this.customerContactRole = 'customer_contact';
        this.professionalInstallerRole = 'professional_installer';
        this.deviceRole = 'device';
        this.externalDeveloperRole = 'external_developer';
        this.userApi = new api_1.UserApi(serviceBaseUrl);
        this.authApi = new api_1.AuthApi(constants_util_1.LOGINNAME_ADMIN, constants_util_1.PASSWORD_ADMIN, serviceBaseUrl);
    }
    UserUtil.prototype.setupUserDetail = function () {
        var userDetail = new api_1.UserDetail();
        userDetail.loginName = constants_util_1.PREFIX + this.generateRandomUserName();
        userDetail.firstName = constants_util_1.PREFIX + 'user-firstName' + new Date().getTime();
        userDetail.lastName = constants_util_1.PREFIX + 'user-lastName' + new Date().getTime();
        userDetail.email = 'success@simulator.amazonses.com';
        userDetail.title = constants_util_1.PREFIX + 'title' + new Date().getTime();
        userDetail.roles = ['Internal administrator'];
        userDetail.accounts = [];
        userDetail.street = constants_util_1.PREFIX + 'street' + new Date().getTime();
        userDetail.postalAddress = constants_util_1.PREFIX + 'postalAddress' + new Date().getTime();
        userDetail.postalCode = constants_util_1.PREFIX + 'postalCode' + new Date().getTime();
        userDetail.country = constants_util_1.PREFIX + 'country' + new Date().getTime();
        userDetail.phone = new Date().getTime() + '';
        userDetail.mobile = new Date().getTime() + '';
        userDetail.organization = constants_util_1.PREFIX + 'organization' + new Date().getTime();
        userDetail.organizationUnit = constants_util_1.PREFIX + 'organizationUnit' + new Date().getTime();
        userDetail.locked = false;
        userDetail.language = constants_util_1.PREFIX + '-language' + new Date().getTime();
        return userDetail;
    };
    UserUtil.prototype.editUserDetail = function (accountId) {
        var userDetail = new api_1.UserDetail();
        userDetail.firstName = constants_util_1.PREFIX + 'user-firstName-edited';
        userDetail.lastName = constants_util_1.PREFIX + 'user-lastName-edited';
        userDetail.email = 'success@simulator.amazonses.com';
        userDetail.title = constants_util_1.PREFIX + 'title-edited';
        userDetail.roles = [''];
        userDetail.accounts = [accountId];
        userDetail.street = constants_util_1.PREFIX + 'street-edited';
        userDetail.postalAddress = constants_util_1.PREFIX + 'postalAddress-edited';
        userDetail.postalCode = constants_util_1.PREFIX + 'postalCode-edited';
        userDetail.country = constants_util_1.PREFIX + 'country-edited';
        userDetail.phone = new Date().getTime() + '' + new Date().getDate();
        userDetail.mobile = new Date().getTime() + '' + new Date().getDate();
        userDetail.organization = constants_util_1.PREFIX + 'organization-edited';
        userDetail.organizationUnit = constants_util_1.PREFIX + 'organizationUnit-edited';
        userDetail.locked = false;
        userDetail.language = constants_util_1.PREFIX + '-language-edited';
        return userDetail;
    };
    UserUtil.prototype.setupUserDetailWithWrongPhone = function () {
        var userDetail = new api_1.UserDetail();
        userDetail.phone = 'phone';
        userDetail.firstName = constants_util_1.PREFIX + 'user-firstName-edited';
        userDetail.lastName = constants_util_1.PREFIX + 'user-lastName-edited';
        userDetail.email = 'success@simulator.amazonses.com';
        userDetail.title = constants_util_1.PREFIX + 'title-edited';
        userDetail.roles = [''];
        userDetail.street = constants_util_1.PREFIX + 'street-edited';
        userDetail.postalAddress = constants_util_1.PREFIX + 'postalAddress-edited';
        userDetail.postalCode = constants_util_1.PREFIX + 'postalCode-edited';
        userDetail.country = constants_util_1.PREFIX + 'country-edited';
        userDetail.mobile = new Date().getTime() + '' + new Date().getDate();
        userDetail.organization = constants_util_1.PREFIX + 'organization-edited';
        userDetail.organizationUnit = constants_util_1.PREFIX + 'organizationUnit-edited';
        userDetail.locked = false;
        userDetail.language = constants_util_1.PREFIX + '-language-edited';
        return userDetail;
    };
    UserUtil.prototype.getRandomUserName = function () {
        return constants_util_1.PREFIX + this.generateRandomUserName();
    };
    UserUtil.prototype.generateRandomUserName = function () {
        var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZqwertzuiopasdfghjklyxcvbnm0123456789';
        var randomString = '';
        for (var i = 0; i < 17; i++) {
            var randomPoz = Math.floor(Math.random() * charSet.length);
            randomString += charSet.substring(randomPoz, randomPoz + 1);
        }
        return randomString;
    };
    UserUtil.prototype.createUser = function (loginname, roles) {
        var _this = this;
        return this.authApi.getToken().then(function (response) {
            _this.userApi.setApiKey(api_1.UserApiApiKeys.JwtAuth_, 'Bearer ' + response.body.accessToken);
            var userItem = _this.setupUserDetail();
            userItem.loginName = loginname;
            userItem.roles = roles;
            return _this.userApi.addUser(userItem);
        }).then(function (response) {
            return response.body.password;
        }).catch(function (e) {
            console.log('createUser ' + e.response.statusCode, e.response.body);
            throw new Error('API ERROR createUser ' + e.response.statusCode + ' ' + e.response.body.Message);
        });
    };
    UserUtil.prototype.createUserWithDetail = function (user, roles) {
        var _this = this;
        return this.authApi.getToken().then(function (response) {
            _this.userApi.setApiKey(api_1.UserApiApiKeys.JwtAuth_, 'Bearer ' + response.body.accessToken);
            user.roles = roles;
            return _this.userApi.addUser(user);
        }).then(function (response) {
            return response.body.password;
        }).catch(function (e) {
            console.log('createUser' + e.response.statusCode, e.response.body);
            throw new Error('API ERROR createUserWithDetail ' + e.response.statusCode + ' ' + e.response.body.Message);
        });
    };
    UserUtil.prototype.addAccountToUser = function (accountId, userId, accountIdTwo) {
        var _this = this;
        return this.authApi.getToken().then(function (response) {
            _this.userApi.setApiKey(api_1.UserApiApiKeys.JwtAuth_, 'Bearer ' + response.body.accessToken);
            var accounts = new api_1.Accounts();
            accounts.push(accountId);
            if (accountIdTwo) {
                accounts.push(accountIdTwo);
            }
            return _this.userApi.addAccountsToUser(userId, accounts);
        }).then(function (response) {
            return true;
        }).catch(function (e) {
            console.log('addAccountToUser' + e.response.statusCode, e.response.body);
            throw new Error('API ERROR addAccountToUser ' + e.response.statusCode + ' ' + e.response.body.Message);
        });
    };
    UserUtil.prototype.deleteUser = async function (uuid) {
        const response = await this.authApi.getToken();
        this.userApi.setApiKey(api_1.UserApiApiKeys.JwtAuth_, 'Bearer ' + response.body.accessToken);
        return this.userApi.deleteUser(uuid)
            .then(function (response) {
                return true;
            }).catch(function (e) {
                console.log('deleteUser' + e.response.statusCode, e.response.body);
                throw new Error('API ERROR deleteUser ' + e.response.statusCode + ' ' + e.response.body.Message);
            });
    };
    return UserUtil;
}());
exports.UserUtil = UserUtil;
//# sourceMappingURL=user.util.js.map