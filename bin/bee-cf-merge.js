#! /usr/bin/env node

const fs = require('fs-extra');
const yaml = require('js-yaml');
const argv = require('yargs').argv;
const utils = require('./lib/utils');
const constants = require('./lib/constants');
const path = require('path');

function verifyInfrastructure(infrastructure) {
    if (!('Service' in infrastructure))
        throw new Error('Invalid format of infrastructure.yml: "Service" property is missing!');
}

function readYmlFile(ymlFile) {
    if (!fs.existsSync(ymlFile))
        throw new Error('Could not find file ' + ymlFile);
    return yaml.safeLoad(fs.readFileSync(ymlFile, 'utf8'));
}

function mergeResources(outCf, sources) {
    sources.map(fileName => {
        const cf = readYmlFile(fileName);
        utils.wlog('Merging Resources template: ' + fileName);
        let cfRes;
        if ('Resources' in cf) {
            cfRes = cf.Resources;
        } else {
            cfRes = cf;
        }
        const keys = Object.keys(cfRes);
        keys.map(res => {
            outCf.Resources = outCf.Resources || {};
            outCf.Resources[res] = cfRes[res];
        });
    });
}
function mergeParameters(outCf, sources) {
    sources.map(fileName => {
        const cf = readYmlFile(fileName);
        utils.wlog('Merging Parameters template: ' + fileName);
        let cfParams;
        if ('Parameters' in cf) {
            cfParams = cf.Parameters;
        } else {
            cfParams = cf;
        }
        const keys = Object.keys(cfParams);
        keys.map(p => {
            outCf.Parameters = outCf.Parameters || {};
            outCf.Parameters[p] = cfParams[p];
        });
    });
}

function mergeOutputs(outCf, sources) {
    sources.map(fileName => {
        const cf = readYmlFile(fileName);
        utils.wlog('Merging Outputs template: ' + fileName);
        let cfOutputs;
        if ('Outputs' in cf) {
            cfOutputs = cf.Outputs;
        } else {
            cfOutputs = cf;
        }
        const keys = Object.keys(cfOutputs);
        keys.map(o => {
            outCf.Outputs = outCf.Outputs || {};
            outCf.Outputs[o] = cfOutputs[o];
        });
    });
}

function buildCloudFormationTemplateYml(service) {
    let outCloudFormation = {
        AWSTemplateFormatVersion: '2010-09-09',
        Transform: 'AWS::Serverless-2016-10-31'
    };
    if (service.MainTemplate) {
        outCloudFormation = readYmlFile(service.MainTemplate);
    }


    let outCloudFormationNoEntries = true;
    if (service.Resources) {
        mergeResources(outCloudFormation, service.Resources);
        outCloudFormationNoEntries = false;
    }
    if (service.Parameters) {
        mergeParameters(outCloudFormation, service.Parameters);
        outCloudFormationNoEntries = false;
    }
    if (service.Outputs) {
        mergeOutputs(outCloudFormation, service.Outputs);
        outCloudFormationNoEntries = false;
    }
    if (outCloudFormationNoEntries)
        console.log('No Templates to be merged!');
    return yaml.safeDump(outCloudFormation, {
        flowLevel: 30,
        styles: {
            '!!int': 'decimal',
            '!!null': 'camelcase'
        }
    });
}

function writeFile(fileName, data) {
    return utils.writeFileToDirectory(utils.defaultWorkingDirectory, fileName, data);
}

try {
    const infrastructurefile = (argv.infrastructure_file) ? argv.infrastructure_file : constants.INFRASTRUCTURE_CONSTANTS.defaultFile;
    const outYmlFile = (argv.output_file) ? argv.output_file : constants.INFRASTRUCTURE_CONSTANTS.defaultGeneratedCFFile;
    utils.ylog('Reading ' + infrastructurefile + '...');
    const infra = readYmlFile(infrastructurefile);
    utils.ylog('Verifying ' + infrastructurefile + '...');
    verifyInfrastructure(infra);
    utils.ylog('Building CloudFormation template...');
    const outYml = buildCloudFormationTemplateYml(infra.Service);
    const wroteOutymlFile = writeFile(outYmlFile, outYml);
    utils.ylog('CloudFormation template file "' + wroteOutymlFile + '" created.');
    utils.ylog('Done.');
    return outYml;
} catch (e) {
    utils.rlog('Error occurred during processing: ', e);
    utils.wlog('Usage: cf-merge [--infrastructure_file=<YAML infrastructure file>] [--output_file=<YAML file path>]')
    process.exit(1);
}