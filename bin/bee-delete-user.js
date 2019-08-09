#! /usr/bin/env node

const argv = require('yargs').argv;
const path = require('path');
const fs = require('fs-extra');
const mdUserUtil = require('./lib/user.util');

const userUtil = new mdUserUtil.UserUtil();
const loginName = 'login-name';

if ((typeof (argv[loginName]) !== 'string') && (typeof (argv.json) !== 'string')) {
    console.error(`ERROR: Invalid --${loginName} or --json option value`);
    process.exit(-1);
    return;
}

let name;
if (argv.json) {
    const jsonFilePath = path.resolve(argv.json);
    if (fs.existsSync(jsonFilePath)) {
        const jsonValue = require(jsonFilePath);
        name = jsonValue.loginName;
    }
} else if (argv[loginName]) {
    name = argv[loginName];
}
if (!name) {
    console.error(`ERROR: Missing or invalid --${loginName} or --json option value`);
    process.exit(-1);
    return;
}

(async () => {
    try {
        if (argv.v) {
            console.log(`DELETE user: ${name}`);
        }
        await userUtil.deleteUser(name);
        process.exit(0);
    } catch (err) {
        console.log(`Error: ${err.message}`, err.stack);
        process.exit(1);
    }
})();
