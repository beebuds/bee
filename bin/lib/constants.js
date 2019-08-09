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
        certificateArn: 'my-certificate-arn',
        hostedZoneName: 'myhosted.zone.name.',
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