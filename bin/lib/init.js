const utils = require('./utils');
const shell = require('shelljs');
const argv = require('yargs').argv;
const fs = require('fs-extra');
const yaml = require('js-yaml');
const constants = require('./constants');
const path = require('path');

module.exports = (argv) => {
    let region = 'eu-west-1';
    if (argv.region && typeof (argv.region) === 'string') {
        region = argv.region;
    }
    let infrastructureFile = (argv.config_file) ? argv.config_file : `./infrastructure/${constants.INFRASTRUCTURE_CONSTANTS.defaultFile}`;
    if (!fs.existsSync(infrastructureFile)) {
        utils.rlog(`Error: Could not load infrastructure configuration ${infrastructureFile}`);
        process.exit(1);
    }

    const posOfLastSlash = infrastructureFile.lastIndexOf('/');
    if (posOfLastSlash > 0) {
        const directoryPathOfConfigFile = infrastructureFile.substring(0, posOfLastSlash);
        console.log(directoryPathOfConfigFile);
        if (shell.exec(`cd ${directoryPathOfConfigFile}`).code !== 0) process.exit(1);
    } else if (posOfLastSlash == 0) {
        utils.rlog("Error: Invalid relative file path for ", infrastructureFile);
        process.exit(1);
    }


    const infrastructureParams = yaml.safeLoad(fs.readFileSync(infrastructureFile, 'utf8'));
    if (!infrastructureParams.Service.PathToParameters || infrastructureParams.Service.PathToParameters.trim() === '') {
        utils.rlog('Error: Missing path to parameters entry.');
        process.exit(1);
    }

    let stage = argv.stage ? argv.stage : 'development';

    const parameterFile = path.resolve(infrastructureParams.Service.PathToParameters + '/' + stage + '.yml');
    console.log('parameter file ', parameterFile);
    const params = yaml.safeLoad(fs.readFileSync(parameterFile, 'utf8'));

    const deploymentStage = params.Stage;
    const serviceName = params.ServiceName;
    const version = argv.release_version ? argv.release_version : Date.now();
    const deploymentBucket = `${serviceName}-${region}-deployment`;
    //TODO: handling stage names
    const bucketPrefix = (argv.release_version && (deploymentStage !== 'myprodstage')) ? argv.release_version : deploymentStage + '/' + version;
    const stackName = serviceName + '-' + deploymentStage;

    const directoryName = path.resolve(constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory);
    const processVariables = {
        infrastructureFile: path.resolve((argv.config_file) ? argv.config_file : `${constants.INFRASTRUCTURE_CONSTANTS.infrastrutureDirectory}/${constants.INFRASTRUCTURE_CONSTANTS.defaultFile}`),
        deploymentBucket: deploymentBucket,
        bucketPrefix: bucketPrefix,
        parameterFile: path.resolve(`${infrastructureParams.Service.PathToParameters}/${stage}.yml`),
        parameterDirectory: path.resolve(`${infrastructureParams.Service.PathToParameters}`),
        stackName: stackName,
        templateFile: path.resolve(`${directoryName}/${constants.INFRASTRUCTURE_CONSTANTS.defaultPackagedCFFile}`),
        templateFileName: `${constants.INFRASTRUCTURE_CONSTANTS.defaultPackagedCFFile}`,
        serviceName: serviceName,
        createSystemInfoEndpoint: infrastructureParams.Service.CreateSystemInfoEndpoint,
        stage: deploymentStage,
        version: version
    }

    fs.mkdirpSync(directoryName);
    fs.writeFileSync(`${directoryName}/cf-variables.json`, JSON.stringify(processVariables), 'utf8');

    return processVariables;
}
