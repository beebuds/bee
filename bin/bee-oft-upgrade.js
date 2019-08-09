#! /usr/bin/env node

const requestPromise = require('request-promise');
const fs = require('fs-extra');
const constants = require('./lib/constants');
const argv = require('yargs').argv;
const utils = require('./lib/utils');
const proxy = require('proxy-agent');


const oftVersion = 'oft-version';
if (!argv[oftVersion] || typeof (argv[oftVersion]) !== 'string') {
    console.error(`ERROR: Missing required parameter --oft-version <version>, e.g. --oft-version 1.16.123`);
    process.exit(1);
}

const version = (argv[oftVersion]) ? argv[oftVersion] : constants.gradleVersion;
const oftPackageName = `openfasttrace-${version}`;
const oftPackageFileNameJar = `${oftPackageName}.jar`;
const oftPackageUrl = `https://github.com/itsallcode/openfasttrace/releases/download/${version}/${oftPackageFileNameJar}`;

const envProxy = process.env.PROXY;
console.log(`proxy: ${envProxy} request:${oftPackageUrl}`);
(() => {
    const resolvedDefaultDir = constants.DEFAULT_DIRECTORY;
    const outFile = `${resolvedDefaultDir}/${oftPackageFileNameJar}`;
    utils.ylog(`Dowload and install openfasttrace package 'v${version}'`);
    let request = requestPromise;
    if (envProxy) {
        request = requestPromise.defaults({ agent: proxy(envProxy) });
    }
    request(oftPackageUrl, {
        gzip: true,
        resolveWithFullResponse: true,
        encoding: null
    }).then(response => {
        fs.ensureDirSync(resolvedDefaultDir);
        fs.writeFileSync(outFile, response.body, 'binary');
    }).catch(err => {
        console.error(`ERROR: ${err.message}`, err.stack);
        process.exit(1);
    });
})();
