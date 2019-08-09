#! /usr/bin/env node

const requestPromise = require('request-promise');
const fs = require('fs-extra');
const constants = require('./lib/constants');
const argv = require('yargs').argv;
const extractZip = require('extract-zip');
const path = require('path');
const utils = require('./lib/utils');


const githubToken = process.env.GH_TOKEN;
if (!githubToken) {
    console.error(`ERROR: Github token not set in environment variable 'GH_TOKEN'`);
    process.exit(1);
}
const swadVersion = 'swad-version';
if (!argv[swadVersion] || typeof (argv[swadVersion]) !== 'string') {
    console.error(`ERROR: Missing required parameter --aws-cli-version <version>, e.g. --aws-cli-version 1.16.123`);
    process.exit(1);
}

const version = argv[swadVersion];
const swadPackageName = version;
const swadPackageFileNameZip = `${swadPackageName}.zip`;
const swadPackageUrl = `https://${githubToken}@git-code.asw.zone/RVD/rvd_swad/archive/${swadPackageFileNameZip}`;
const envProxy = process.env.https_proxy || process.env.http_proxy;
console.log(`proxy: ${envProxy} GH_TOKEN=${githubToken && typeof (githubToken) === 'string'}`);
(async () => {
    utils.ylog(`Dowload and install SWAD 'v${version}'`);
    let request = requestPromise;
    const resolvedDefaultDir = path.resolve(constants.DEFAULT_DIRECTORY);
    const downloadedSwadDir = `${resolvedDefaultDir}/rvd_swad-${version}`;
    const outFile = `${resolvedDefaultDir}/${swadPackageFileNameZip}`;
    if (!fs.existsSync(downloadedSwadDir)) {
        request({
            url: swadPackageUrl,
            gzip: true,
            resolveWithFullResponse: true,
            encoding: null
        }).then(response => {
            fs.ensureDirSync(resolvedDefaultDir);
            fs.writeFileSync(outFile, response.body, 'binary');
            extractZip(outFile, { dir: resolvedDefaultDir }, function (err) {
                if (err) {
                    utils.rlog(`ERROR: ${err.message}`, err.stack);
                    process.exit(1);
                }
                fs.removeSync(outFile);
            });
        }).catch(err => {
            utils.rlog(`ERROR: ${err.message}`, err.stack);
            process.exit(1);
        });
    } else {
        console.log(`SWAD v${version} already exists, nothing to do.`);
    }
})();
