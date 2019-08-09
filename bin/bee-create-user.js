#! /usr/bin/env node

const argv = require('yargs').argv;
const fs = require('fs-extra');
const path = require('path');
const mdUserUtil = require('./lib/user.util');
const mdLoginUtil = require('./lib/login.util');

if (!argv.stage) {
    console.error(`ERROR: Missing --stage option for the login service, e.g. --stage test`);
    process.exit(-1);
    return;
}

if (!argv.roles || typeof (argv.roles) !== 'string') {
    console.error(`ERROR: Invalid or missing --roles option value`);
    process.exit(-1);
    return;
}

if (!argv.out || typeof (argv.out) !== 'string') {
    console.error(`ERROR: Invalid or missing --out option value, e.g. --out token.json`);
    process.exit(-1);
    return;
}

const serviceUrls = require(`./lib/service-base-urls-${argv.stage}-stage.util`);
const userUtil = new mdUserUtil.UserUtil(serviceUrls.BASE);
const loginUtil = new mdLoginUtil.LoginUtil();
const testLoginName = userUtil.generateRandomUserName();

const roles = argv.roles.split(',').map(r => r.trim());
const outputPath = `${argv.out}`;
(async () => {
    try {
        const pw = await userUtil.createUser(testLoginName, roles);
        const res = await loginUtil.loginAsUserWithPasswordChange(serviceUrls.BASE, testLoginName, pw);
        const outData = {
            loginName: res.body.loginName,
            scope: res.body.scope,
            token: res.body.accessToken
        }
        fs.mkdirpSync(path.dirname(outputPath));
        fs.writeFileSync(outputPath, JSON.stringify(outData));
        if (argv.v) {
            console.log(`
        LOGIN_NAME: ${outData.loginName}
        SCOPE: ${outData.scope}
        TOKEN: ${outData.token}
        EXPIRES_IN: ${res.body.expiresIn}
        `);
        }
        process.exit(0);
    } catch (err) {
        console.log(`Error: ${err.message}`, err.stack);
        process.exit(1);
    }
})();
