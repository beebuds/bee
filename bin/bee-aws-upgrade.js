#! /usr/bin/env node

const requestPromise = require('request-promise');
const fs = require('fs-extra');
const constants = require('./lib/constants');
const argv = require('yargs').argv;
const targz = require('targz');
const path = require('path');
const utils = require('./lib/utils');
const homedir = require('os').homedir();

const awsCliVersion = 'aws-cli-version';
if (!argv[awsCliVersion] || typeof (argv[awsCliVersion]) !== 'string') {
    console.error(`ERROR: Missing required parameter --aws-cli-version <version>, e.g. --aws-cli-version 1.16.123`);
    process.exit(1);
}

const version = argv[awsCliVersion];
const awsCliPackageName = `awscli-${version}`;
const awsCliPackageFileNameTarGz = `${awsCliPackageName}.tar.gz`;
const awsCliPackageUrl = `https://files.pythonhosted.org/packages/05/c4/76b06606473dcbafcbf5fd77493541d4c231ad42ce58b48e668c46804b6b/${awsCliPackageFileNameTarGz}`;

const envProxy = process.env.https_proxy || process.env.http_proxy;
(() => {
    utils.ylog(`Dowload and install AWS CLI package v'${version}'`);
    let request = requestPromise;
    if (envProxy) {
        request = requestPromise.defaults({ proxy: envProxy });
    }
    request(awsCliPackageUrl, {
        gzip: true,
        encoding: null
    }).then(response => {
        const resolvedDefaultDir = path.resolve(`${homedir}/.bee`);
        const outFile = `${resolvedDefaultDir}/${awsCliPackageFileNameTarGz}`;
        console.log(resolvedDefaultDir);
        fs.ensureDirSync(resolvedDefaultDir);
        fs.writeFileSync(outFile, response, 'binary');
        targz.decompress({
            src: outFile,
            dest: resolvedDefaultDir
        }, function (err) {
            if (err) {
                console.error(`ERROR: ${err.message}`, err.stack);
                process.exit(1);
            }
            const awsCliDirName = 'awscli';
            const awsCliDir = `${resolvedDefaultDir}/${awsCliDirName}`;
            if (fs.existsSync(awsCliDir)) {
                fs.removeSync(awsCliDir);
            }
            fs.renameSync(`${resolvedDefaultDir}/${awsCliPackageName}`, awsCliDir);
            fs.removeSync(outFile);
        });
    }).catch(err => {
        console.error(`ERROR: ${err.message}`, err.stack);
        process.exit(1);
    });
})();
