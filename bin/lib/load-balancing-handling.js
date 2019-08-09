const utils = require('./utils');
const fs = require('fs-extra');
const constants = require('./constants');
const path = require('path');
const shell = require('shelljs');

function createCustomDomain(params, credentialParams) {
  utils.verifyParams(params, ['customDomainName', 'certificateArn']);
  const domainNameExistCheckCommand = `${constants.INFRASTRUCTURE_CONSTANTS.awsCliCommand} apigateway get-domain-name --domain-name ${params.customDomainName} ${utils.getCredentialsOptions(credentialParams)}`;
  console.log(`run ${domainNameExistCheckCommand}`);
  const shellResult = shell.exec(domainNameExistCheckCommand);
  let result = shellResult;
  if (shellResult.code !== 0) {
    result = utils.awsShellCommand(`aws apigateway create-domain-name --domain-name ${params.customDomainName} --certificate-arn ${params.certificateArn} ${utils.getCredentialsOptions(credentialParams)}`)();
    if (result.code !== 0) {
      utils.ylog(`Custom domain could not be created. ${result.stdout}`);
      process.exit(1);
    }
  } else {
    utils.ylog(`domain name '${params.customDomainName}'already exists -> do not create.`);
  }

  const createDomainNameOutput = JSON.parse(result.stdout);
  return createDomainNameOutput;
}

function createBasePathMapping(params, credentialParams) {
  const basePathMappingExistCheckCommand = `${constants.INFRASTRUCTURE_CONSTANTS.awsCliCommand} apigateway get-base-path-mapping --domain-name ${params.customDomainName} --base-path ${params.basePath} ${utils.getCredentialsOptions(credentialParams)}`;
  console.log(`run ${basePathMappingExistCheckCommand}`);
  const shellResult = shell.exec(basePathMappingExistCheckCommand);
  if (shellResult.code !== 0) {
    utils.awsShellCommand(`aws apigateway create-base-path-mapping --domain-name ${params.customDomainName} --base-path ${params.basePath} --rest-api-id ${params.restApiId} --stage ${params.stage} ${utils.getCredentialsOptions(credentialParams)}`)();
  } else {
    utils.ylog(`base path mapping '${params.basePath}' already exists -> do not create.`);
  }
}


function createRoute53RecordSets(params, credentialParams) {
  createRoute53RecordSetsIpv4(params, credentialParams);
  createRoute53RecordSetsIpv6(params, credentialParams);
}

function createRoute53RecordSetsIpv4(params, credentialParams) {
  utils.awsShellCommand(`aws route53 change-resource-record-sets --hosted-zone-id ${params.hostedZoneId} --change-batch file://${getChangeRecordSetInputJson(params, 'A')} ${utils.getCredentialsOptions(credentialParams)}`)();
}

function createRoute53RecordSetsIpv6(params, credentialParams) {
  utils.awsShellCommand(`aws route53 change-resource-record-sets --hosted-zone-id ${params.hostedZoneId} --change-batch file://${getChangeRecordSetInputJson(params, 'AAAA')} ${utils.getCredentialsOptions(credentialParams)}`)();
}

function getChangeRecordSetInputJson(params, type) {
  const recordSetJson = {
    Comment: `Record set upsert for ${params.serviceName} type ${type}`,
    Changes: [
      {
        Action: "UPSERT",
        ResourceRecordSet: {
          Name: `${params.customDomainName}.`,
          Type: type,
          AliasTarget: {
            HostedZoneId: params.domainNameDetails.distributionHostedZoneId,
            DNSName: params.domainNameDetails.distributionDomainName,
            EvaluateTargetHealth: false
          }
        }
      }
    ]
  };
  fs.writeFileSync(`${constants.DEFAULT_DIRECTORY}/route53-change-set.json`, JSON.stringify(recordSetJson));
  return path.resolve(`${constants.DEFAULT_DIRECTORY}/route53-change-set.json`);
}

function getHostedZoneId(hostedZoneName, credentialParams) {
  const result = utils.awsShellCommand(`aws route53 list-hosted-zones-by-name --dns-name ${hostedZoneName} ${utils.getCredentialsOptions(credentialParams)}`)();
  const hostedZones = JSON.parse(result.stdout);
  const hostedZoneId = hostedZones.HostedZones[0]['Id'];
  return hostedZoneId.replace('/hostedzone/', '');
}

function createLBEntry(params, credentialParams) {
  utils.verifyParams(params, ['hostedZoneName'])
  const hostedZoneId = getHostedZoneId(params.hostedZoneName, credentialParams);
  params.hostedZoneId = hostedZoneId;
  const createDomainNameOutput = createCustomDomain(params, credentialParams);
  params.domainNameDetails = createDomainNameOutput;

  createBasePathMapping(params, credentialParams);
  createRoute53RecordSets(params, credentialParams);
}



module.exports.createLBEntry = createLBEntry;