#! /usr/bin/env node

const requestPromise = require('request-promise');
const fs = require('fs-extra');
const constants = require('./lib/constants');
const argv = require('yargs').argv;
const extractZip = require('extract-zip');
const path = require('path');
const utils = require('./lib/utils');
const homedir = require('os').homedir();

const gradleVersion = 'gradle-version';
if (!argv[gradleVersion] || typeof (argv[gradleVersion]) !== 'string') {
    console.error(`ERROR: Missing required parameter --aws-cli-version <version>, e.g. --aws-cli-version 1.16.123`);
    process.exit(1);
}

const version = (argv[gradleVersion]) ? argv[gradleVersion] : constants.gradleVersion;
const gradlePackageName = `gradle-${version}`;
const gradlePackageFileNameZip = `${gradlePackageName}-bin.zip`;
const gradlePackageUrl = `https://services.gradle.org/distributions/${gradlePackageFileNameZip}`;

const envProxy = process.env.https_proxy || process.env.http_proxy;
(() => {
    utils.ylog(`Dowload and install gradle package 'v${version}'`);
    let request = requestPromise;
    if (envProxy) {
        request = requestPromise.defaults({ proxy: envProxy });
    }
    request(gradlePackageUrl, {
        gzip: true,
        resolveWithFullResponse: true,
        encoding: null
    }).then(response => {
        const resolvedDefaultDir = path.resolve(constants.DEFAULT_DIRECTORY);
        const outFile = `${resolvedDefaultDir}/${gradlePackageFileNameZip}`;
        console.log(resolvedDefaultDir);
        fs.ensureDirSync(resolvedDefaultDir);
        fs.writeFileSync(outFile, response.body, 'binary');
        extractZip(outFile, { dir: resolvedDefaultDir }, function (err) {
            if (err) {
                console.error(`ERROR: ${err.message}`, err.stack);
                process.exit(1);
            }
            if (fs.existsSync(constants.GRADLE.dir)) {
                fs.removeSync(constants.GRADLE.dir);
            }
            fs.renameSync(`${resolvedDefaultDir}/${gradlePackageName}`, constants.GRADLE.dir);
            fs.removeSync(outFile);
        });
    }).catch(err => {
        console.error(`ERROR: ${err.message}`, err.stack);
        process.exit(1);
    });
})();
