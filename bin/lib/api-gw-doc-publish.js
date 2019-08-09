const utils = require('./utils');

function createDocumentationVersion(params, credentialParams) {
    utils.verifyParams(params, [`restApiId`, `version`]);
    utils.awsShellCommand(`aws apigateway create-documentation-version --rest-api-id ${params.restApiId} --documentation-version ${params.version} ${utils.getCredentialsOptions(credentialParams)}`)();

}

function associateStageWithDocumentationVersion(params, credentialParams){
    utils.verifyParams(params, [`restApiId`, `stage`, `version`]);
    utils.awsShellCommand(`aws apigateway update-stage --rest-api-id ${params.restApiId} --stage-name ${params.stage} --patch-operations op=replace,path=/documentationVersion,value=${params.version} ${utils.getCredentialsOptions(credentialParams)}`)();
}


function publishApiGatewayDocumentationVersion(params, credentialParams){
    createDocumentationVersion(params,credentialParams);
    associateStageWithDocumentationVersion(params,credentialParams);
}


module.exports.publishApiGatewayDocumentationVersion = publishApiGatewayDocumentationVersion;