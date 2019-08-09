const utils = require('./utils');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const constants = require('./constants');
const shell = require('shelljs');
const apiGwDocPublish = require('./api-gw-doc-publish');


/**
 * 
 * @param {*} params 
 * required: params.restApiId, params.stage, params.outputFile
 * optional: params.profile
 * @param {*} credentialsParams
 * required: credentialsParams.region
 * optional: credentialsParams.profile
 */
function exportSwagger(params, credentialsParams) {
    utils.verifyParams(params, ['restApiId', 'stage', 'outputFile']);
    const credentialsOpts = utils.getCredentialsOptions(credentialsParams);
    const resolvedOutputFile = path.resolve(params.outputFile);
    fs.ensureDirSync(path.dirname(resolvedOutputFile));
    const shellResult = utils.awsShellCommand(`aws apigateway get-export --rest-api-id ${params.restApiId} --stage-name ${params.stage} --export-type swagger ${resolvedOutputFile} ${credentialsOpts}`)();
    if (shellResult.code !== 0) {
        throw new Error(`Could not export swagger document from rest api (id: ${params.restApiId})`);
    }

}
/**
 * 
 * @param {string} inFile A JSON file to be converted.
 * @param {string} outFile A YAML file to store the converted output.
 */
function convertFileJSON2YAML(inFile, outFile) {
    const resolvedInFile = path.resolve(inFile);
    if (fs.existsSync(resolvedInFile)) {
        const jsonData = require(resolvedInFile);
        const yamlData = yaml.safeDump(jsonData, {
            flowLevel: 30,
            styles: {
                '!!int': 'decimal',
                '!!null': 'camelcase'
            }
        });
        const resolvedOutfile = path.resolve(outFile);
        fs.ensureDir(path.dirname(resolvedOutfile));
        fs.writeFileSync(resolvedOutfile, yamlData);
    } else {
        throw new Error(`Could not read ${resolvedInFile}`);
    }
}
/**
 * Possible combinations:
 * S3 -> local,
 * local -> S3,
 * S3 -> S3
 * @param {string} from S3Uri or local directory
 * @param {string} to S3Uri or local directory
 * @param {*} credentialsParams
 * required: credentialsParams.region
 * optional: credentialsParams.profile
 * @param {string} acl Sets the ACL for the object when the command is performed.
 * Only accepts values of private, public-read, public-read-write, authenticated-read, aws-exec-read, bucket-owner-read, bucket-owner-full-control and log-delivery-write.
 * 
 */
function syncWithS3(from, to, credentialsParams, acl) {
    const credentialsOpts = utils.getCredentialsOptions(credentialsParams);
    const s3UriRegEx = new RegExp(/^s3:\/\//);
    const getBucketName = (s3Uri) => s3Uri.replace(s3UriRegEx, '');
    const aclOpt = (acl) ? `--acl ${acl}` : '';
    if (!to.match(s3UriRegEx)) {
        fs.ensureDirSync(path.resolve(to));
    } else if (shell.exec(`${constants.INFRASTRUCTURE_CONSTANTS.awsCliCommand} s3api head-bucket --bucket ${getBucketName(to)} ${credentialsOpts}`).code !== 0) {
        console.log(`Bucket '${getBucketName(to)}' not found -> create it!`);
        if (utils.awsShellCommand(`aws s3api create-bucket --bucket ${getBucketName(to)} ${utils.getCredentialsOptions(credentialsParams, ['--profile'])}`)().code !== 0) {
            throw new Error(`Could create bucket '${to}'`);
        }
    }
    const shellResult = utils.awsShellCommand(`aws s3 sync ${from} ${to} ${aclOpt} ${credentialsOpts}`)();
    if (shellResult.code !== 0) {
        throw new Error(`Could not sync ${from} to ${to}`);
    }
}



function publishDocInApiGateway(params,credentialsParams){
    apiGwDocPublish.publishApiGatewayDocumentationVersion(params,credentialsParams);
}

function publishApiDoc(params, credentialsParams) {

    utils.verifyParams(params, ['serviceName', 'restApiId', 'stage', 'apiDocBucket']);

    publishDocInApiGateway(params,credentialsParams);

    const baseOutDir = `build/api-doc`;
    const baseOutDirWithServiceName = `${baseOutDir}/${params.serviceName}`;
    const exportedJsonFile = `${baseOutDirWithServiceName}/overallapi.json`;

    exportSwagger({
        restApiId: params.restApiId,
        stage: params.stage,
        outputFile: exportedJsonFile
    }, credentialsParams);
    const exportedYamlFile = `${baseOutDirWithServiceName}/overallapi.yaml`;
    convertFileJSON2YAML(exportedJsonFile, exportedYamlFile);
    fs.removeSync(exportedJsonFile);

    syncWithS3('s3://rvd-api-doc-commons', baseOutDirWithServiceName, credentialsParams);
    syncWithS3(baseOutDir, `s3://${params.apiDocBucket}`, credentialsParams, 'public-read');
}

module.exports.exportSwagger = exportSwagger;
module.exports.convertFileJSON2YAML = convertFileJSON2YAML;
module.exports.syncWithS3 = syncWithS3;
module.exports.publishApiDoc = publishApiDoc;