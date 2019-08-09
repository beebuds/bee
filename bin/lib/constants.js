const os = require('os');
const path = require('path');
const defaultOutDirectory = '.bee';
const userHome = `${path.resolve(os.homedir())}`;

const gradleDir = `${defaultOutDirectory}/gradle`;
module.exports.DEFAULT_DIRECTORY = defaultOutDirectory;
module.exports.GRADLE = {
    version: '5.4.1',
    dir: gradleDir,
    command: `${gradleDir}/bin/gradle`
};

const oftDir = `${defaultOutDirectory}`;
const oftVersion = '2.3.5';
const oftPackageName = `openfasttrace-${oftVersion}.jar`;
module.exports.OFT = {
    version: oftVersion,
    dir: oftDir,
    packageName: oftPackageName,
    command: `java -jar ${oftDir}/${oftPackageName}`
};
module.exports.CURL = {
    command: os.platform() === 'win32' ? 'curl' : '/usr/bin/curl'
}
module.exports.DEFAULT_REGION = 'eu-west-1';
module.exports.INFRASTRUCTURE_CONSTANTS = {
    defaultFile: 'infrastructure.yml',
    defaultGeneratedCFFile: 'generated-cloudformation.yml',
    defaultPackagedCFFile: 'cloudformation.yml',
    defaultOutDirectory: defaultOutDirectory,
    defaultOutDirectoryRelativeToInfratructureDirectory: `../${defaultOutDirectory}`,
    infrastrutureDirectory: 'infrastructure',
    defaultSystemInfoFileName: 'system-info.json',
    awsCliVersion: '1.16.186',
    awsCliCommand: os.platform() === 'win32' ? 'aws' : '/usr/local/bin/aws'
}

const route53Constants = {
    development: {
        certificateArn: 'arn:aws:acm:us-east-1:961348157110:certificate/f103c866-fd21-407c-813a-f4ff55ad8310',
        hostedZoneName: 'dev.continental-rvd.de.',
        basePath: 'v1'
    },
    integration: {
        certificateArn: 'arn:aws:acm:us-east-1:961348157110:certificate/13b52ff5-546e-4a65-92af-3f4f21c6690c',
        hostedZoneName: 'integration.continental-rvd.de.',
        basePath: 'v1'
    },
    test: {
        certificateArn: 'arn:aws:acm:us-east-1:961348157110:certificate/10199254-6bdf-4918-b9f4-f3701484939c',
        hostedZoneName: 'test.continental-rvd.de.',
        basePath: 'v1'
    },
    contiprelive: {
        certificateArn: 'arn:aws:acm:eu-west-1:593609151314:certificate/b74dc5ac-27b0-46d9-b038-9def84db610d',
        hostedZoneName: 'prelive.continental-rvd.de.',
        basePath: 'v1'
    },
    contilive: {
        certificateArn: 'arn:aws:acm:us-east-1:533029526602:certificate/154ec98c-a1c1-45af-9c41-8dce6ba493b0',
        hostedZoneName: 'continental-connected-services.com.',
        basePath: 'v1'
    }
}

module.exports.ROUTE53_CONSTANTS = {
    get: (stage) => {
        return (route53Constants[stage]) ? route53Constants[stage] : route53Constants.development;
    },
    getCustomDomainName: (serviceName, stage) => {
        if (route53Constants[stage]) {
            return `${serviceName}.${route53Constants[stage].hostedZoneName}`.replace(/\.$/, '');
        }
        return `${serviceName}-${stage}.${route53Constants.development.hostedZoneName}`.replace(/\.$/, '');
    }
}