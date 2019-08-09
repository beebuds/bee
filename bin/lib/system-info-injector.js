const utils = require('./utils');

module.exports.injectSystemInfo = async (params) => {
    utils.verifyParams(params, ['iam', 'apiGateway', 'restApiId', 'stage', 'serviceName', 'region', 'bucket', 'bucketPrefix']);
    const { restApiId, iam, apiGateway, stage, serviceName, region, bucket, bucketPrefix } = params;

    const roleName = `${stage}-${serviceName}-system-info-role`;
    let roleResponse;
    try {
        roleResponse = await iam.getRole({ RoleName: roleName }).promise();
    } catch (_err) {
        console.log(`create Role: ${roleName}`);
        const createRoleParams = {
            AssumeRolePolicyDocument: `{
                "Version": "2012-10-17",
                "Statement": [
                  {
                    "Sid": "",
                    "Effect": "Allow",
                    "Principal": {
                      "Service": "apigateway.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                  }
                ]
              }`,
            RoleName: roleName
        };
        try {
            roleResponse = await iam.createRole(createRoleParams).promise();
        } catch (err) {
            throw new Error(`ERROR: ${err.message} ${JSON.stringify(err.stack)}`);
        }
    }
    const accountId = roleResponse.Role.Arn.split(':')[4];
    const policyName = `bee-s3-${stage}-${serviceName}-get-system-info-policy`;
    const policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;
    try {
        await iam.detachRolePolicy({ PolicyArn: policyArn, RoleName: roleName }).promise();
        await iam.deletePolicy({ PolicyArn: policyArn }).promise();
    } catch (err) {
        console.warn(`WARN: ${err.message}`);
    }
    let policyResponse;
    try {
        const createPolicyParams = {
            PolicyName: policyName,
            PolicyDocument: `{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "s3:GetObject",
                        "Resource": "arn:aws:s3:::${bucket}/${bucketPrefix}/system-info.json"
                    }
                ]
            }`
        };
        console.log(`create Policy: ${JSON.stringify(createPolicyParams)}`);
        policyResponse = await iam.createPolicy(createPolicyParams).promise();
    } catch (err) {
        console.warn(`WARN: ${err.message}`, err.stack);
    }

    const resultPolicyArn = (policyResponse) ? policyResponse.Policy.Arn : policyArn;
    console.log(`result policyArn: ${resultPolicyArn}`);
    const attachRolePolicyParams = {
        RoleName: roleResponse.Role.RoleName,
        PolicyArn: resultPolicyArn
    };

    try {
        await iam.attachRolePolicy(attachRolePolicyParams).promise();

        const hasMethod = (s, method) => s.resourceMethods && s.resourceMethods[method];
        const resources = await apiGateway.getResources({ restApiId: restApiId }).promise();
        const rootResource = resources.items.filter(r => r.path.match(/^\/$/))[0];
        const systemInfoResources = resources.items.filter(r => r.path.match(/^\/system\/info/));
        let systemInfoResource = systemInfoResources[0];
        if (systemInfoResources.length === 0) {
            console.log(`create resource: /system/info`);
            const systemResource = await apiGateway.createResource({ restApiId: restApiId, parentId: rootResource.id, pathPart: 'system' }).promise();
            systemInfoResource = await apiGateway.createResource({ restApiId: restApiId, parentId: systemResource.id, pathPart: 'info' }).promise();
        }

        const httpMethod = 'GET';
        if (!hasMethod(systemInfoResource, httpMethod)) {
            const putMethodParams = {
                restApiId: restApiId,
                resourceId: systemInfoResource.id,
                operationName: 'getSystemInfo',
                httpMethod: httpMethod,
                authorizationType: 'NONE'
            };
            console.log(`create method: ${JSON.stringify(putMethodParams)}`);
            await apiGateway.putMethod(putMethodParams).promise();
            const putMethodResponseParams = {
                restApiId: restApiId,
                resourceId: systemInfoResource.id,
                httpMethod: httpMethod,
                statusCode: '200'
            };
            console.log(`create method response: ${JSON.stringify(putMethodResponseParams)}`);
            await apiGateway.putMethodResponse(putMethodResponseParams).promise();
        }
        const optionsHttpMethod = 'OPTIONS';
        if (!hasMethod(systemInfoResource, optionsHttpMethod)) {
            const putMethodParams = {
                restApiId: restApiId,
                resourceId: systemInfoResource.id,
                httpMethod: optionsHttpMethod,
                authorizationType: 'NONE'
            };
            console.log(`create method: ${JSON.stringify(putMethodParams)}`);
            await apiGateway.putMethod(putMethodParams).promise();
            const prefixedCorsHeader = (prefix, corsHeader) => `${prefix}${corsHeader}`
            const corsHeaderAllowOrigin = `Access-Control-Allow-Origin`;
            const corsHeaderAllowHeaders = `Access-Control-Allow-Headers`;
            const corsHeaderAllowMethods = `Access-Control-Allow-Methods`;
            const prefix = 'method.response.header.';
            const putMethodResponseParamsOPTIONS = {
                restApiId: restApiId,
                resourceId: systemInfoResource.id,
                httpMethod: optionsHttpMethod,
                statusCode: '200'
            };
            putMethodResponseParamsOPTIONS.responseParameters = {};
            putMethodResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowOrigin)] = true;
            putMethodResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowHeaders)] = true;
            putMethodResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowMethods)] = true;
            console.log(`create method response: ${JSON.stringify(putMethodResponseParamsOPTIONS)}`);
            await apiGateway.putMethodResponse(putMethodResponseParamsOPTIONS).promise();

            const putIntegrationParamsOPTIONS = {
                restApiId: restApiId,
                resourceId: systemInfoResource.id,
                httpMethod: optionsHttpMethod,
                integrationHttpMethod: optionsHttpMethod,
                passthroughBehavior: 'WHEN_NO_TEMPLATES',
                type: 'MOCK',
                requestTemplates: {
                    'application/json': '{"statusCode":200}'
                }
            }
            console.log(`put aws s3 integration: ${JSON.stringify(putIntegrationParamsOPTIONS)}`);
            await apiGateway.putIntegration(putIntegrationParamsOPTIONS).promise();

            const putIntegrationResponseParamsOPTIONS = {
                httpMethod: optionsHttpMethod,
                resourceId: systemInfoResource.id,
                restApiId: restApiId,
                statusCode: '200'
            };
            putIntegrationResponseParamsOPTIONS.responseParameters = {};
            putIntegrationResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowOrigin)] = "'*'";
            putIntegrationResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowHeaders)] = "'Content-Type'";
            putIntegrationResponseParamsOPTIONS.responseParameters[prefixedCorsHeader(prefix, corsHeaderAllowMethods)] = "'GET'";
            console.log(`put aws s3 integration response: ${JSON.stringify(putIntegrationResponseParamsOPTIONS)}`);
            await apiGateway.putIntegrationResponse(putIntegrationResponseParamsOPTIONS).promise();
        }
        const putIntegrationParams = {
            restApiId: restApiId,
            resourceId: systemInfoResource.id,
            httpMethod: httpMethod,
            integrationHttpMethod: httpMethod,
            type: 'AWS',
            uri: `arn:aws:apigateway:${region}:s3:path/${bucket}/${bucketPrefix}/system-info.json`,
            credentials: roleResponse.Role.Arn
        }
        console.log(`put aws s3 integration: ${JSON.stringify(putIntegrationParams)}`);
        await apiGateway.putIntegration(putIntegrationParams).promise();

        const putIntegrationResponseParams = {
            httpMethod: httpMethod,
            resourceId: systemInfoResource.id,
            restApiId: restApiId,
            statusCode: '200'
        };
        console.log(`put aws s3 integration response: ${JSON.stringify(putIntegrationResponseParams)}`);
        await apiGateway.putIntegrationResponse(putIntegrationResponseParams).promise();
        await apiGateway.createDeployment({
            restApiId: restApiId,
            stageName: stage
        }).promise();
    } catch (err) {
        console.error(`ERROR: ${err.message}`, err.stack);
        return Promise.reject(err);
    }

    return Promise.resolve();
}
