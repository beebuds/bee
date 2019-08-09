const fs = require('fs');
const constants = require('./constants');
const proxy = require('proxy-agent');
const shell = require('shelljs');

const FgWhite = "\x1b[37m";
const FgRed = "\x1b[31m";
const FgGreen = "\x1b[32m";
const FgYellow = "\x1b[33m";
const FgBlue = "\x1b[94m";
const defaultWorkingDirectory = constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory;
const path = require('path');
const awsCli = `${require('os').homedir()}/.bee/awscli/bin/aws`;

function removeStartingDotSlash(filePath) {
    return filePath.replace(/^(\.\/)/, '');
}

function log(msg, optionalParams) {
    if (optionalParams) {
        console.log(msg, optionalParams);
    } else {
        console.log(msg);
    }
}

function wlog(msg, optionalParams) {
    log(FgWhite + msg + FgWhite, optionalParams);
}

function ylog(msg, optionalParams) {
    log(FgYellow + msg + FgWhite, optionalParams);
}

function rlog(msg, ...optionalParams) {
    log(FgRed + msg + FgWhite, optionalParams);
}

function glog(msg, optionalParams) {
    log(FgGreen + msg + FgWhite, optionalParams);
}

function blog(msg, optionalParams) {
    log(FgBlue + msg + FgWhite, optionalParams);
}
function writeFileToDirectory(directory, fileName, data) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }
    const path = directory + '/' + fileName;
    fs.writeFileSync(path, data);
    return path;
}
function loadCfVariables() {
    return JSON.parse(fs.readFileSync(`${defaultWorkingDirectory}/cf-variables.json`, 'utf8'));
}
function loadCredentials(AWS, profile, region) {
    console.log(`loadCredentials profile:${profile} region:${region}`);
    AWS.config.region = 'eu-west-1';
    const envProxy = process.env.https_proxy || process.env.http_proxy;
    if (profile && typeof (profile) === 'string') {
        console.log(`do AWS.SharedIniFileCredentials: ${profile}`);
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: profile });
    } else if (envProxy) {
        console.log(`Use proxy config ${envProxy}`);
        AWS.config.update({
            httpOptions: { agent: proxy(envProxy) }
        });
    }

    if (region) {
        AWS.config.region = region;
    }
}
function shellCommand(cmd, desc) {
    return function (_shellResults) {
        if (desc) {
            ylog(`${desc}`);
        }
        const shellResult = shell.exec(cmd);
        if (0 !== shellResult.code) {
            rlog(`ERROR: Failed on running command: ${cmd}`);
            process.exit(shellResult.code);
        }
        return shellResult;
    }
}
function awsShellCommand(cmd, desc) {
    //TODO: find out how to use local aws cli
    const command = cmd.trim().replace(/^aws/, constants.INFRASTRUCTURE_CONSTANTS.awsCliCommand);
    console.log(`run ${command}`);
    return shellCommand(command, desc);
}
async function runCommands(cmds) {
    let shellResults = [];
    for (let i = 0; i < cmds.length; ++i) {
        const cmd = cmds[i];
        try {
            if (cmd) shellResults[i] = await cmd(shellResults);
        } catch (err) {
            rlog(`ERROR: Failed to execute the function ${cmd.name}:`, err.stack);
            process.exit(1)
        }
    }
}

function verifyParams(params, required) {
    const paramKeys = Object.keys(params);
    required.map(r => {
        if (paramKeys.filter(p => r === p).length === 0) {
            throw new Error(`Missing parameter '${r}', required parameters are: ${JSON.stringify(required)}`);
        };
    });
}

function uploadToS3(file, bucket, bucketPrefix, args) {
    return awsShellCommand(`aws s3 cp ${file} s3://${bucket}/${bucketPrefix}/${path.basename(file)} ${args}`)();
}

async function getApiId(params) {
    verifyParams(params, ['AWSCloudFormation']);
    if (params.apiId) return Promise.resolve(params.apiId);
    if (!params.apiId && params.stackName) {
        const cf = params.AWSCloudFormation;
        const describeStackParams = {
            StackName: params.stackName
        };

        const stackResources = await cf.describeStackResources(describeStackParams).promise();
        const apiRes = stackResources.StackResources.filter(r => {
            return r.ResourceType === 'AWS::ApiGateway::RestApi'
        });
        if (apiRes.length > 0) {
            console.log(apiRes[0].PhysicalResourceId);
            return Promise.resolve(apiRes[0].PhysicalResourceId);
        }
    }
    return Promise.reject(undefined);
}

function isOneOf(val, staticValues) {
    return staticValues.filter(v => v === val).length > 0;
}

function getCredentialsOptions(credentialsParams, relevantOptionItems) {
    verifyParams(credentialsParams, ['region']);
    const options = [];
    const addOptionIfExist = (param, paramOptionName) => (param) ? options.push(`${paramOptionName} ${param}`) : undefined;
    addOptionIfExist(credentialsParams.region, '--region');
    addOptionIfExist(credentialsParams.profile, '--profile');
    return options.reduce((o, a) => {
        if (relevantOptionItems && relevantOptionItems.length > 0) {
            for (const ri of relevantOptionItems) {
                if (a.startsWith(ri)) {
                    return o.concat((o) ? ` ${a}` : a);
                }
            }
            return o;
        } else {
            return o.concat((o) ? ` ${a}` : a);
        }
    }, '');
}

module.exports.defaultWorkingDirectory = defaultWorkingDirectory;

module.exports.wlog = wlog;
module.exports.rlog = rlog;
module.exports.ylog = ylog;
module.exports.glog = glog;
module.exports.blog = blog;
module.exports.isOneOf = isOneOf;
module.exports.writeFileToDirectory = writeFileToDirectory;
module.exports.loadCfVariables = loadCfVariables;
module.exports.loadCredentials = loadCredentials;
module.exports.getCredentialsOptions = getCredentialsOptions;

module.exports.removeStartingDotSlash = removeStartingDotSlash;

module.exports.getRelativePath = function (referenceFilePath, relativePath) {
    const posOfLastSlash = referenceFilePath.lastIndexOf('/');
    const pathPrefix = referenceFilePath.substring(0, posOfLastSlash + 1);
    const relPart = removeStartingDotSlash(relativePath).replace(/(\/)$/, '');
    const result = pathPrefix + relPart;
    return result;
}

module.exports.shellCommand = shellCommand;
module.exports.awsShellCommand = awsShellCommand;
module.exports.runCommands = runCommands;
module.exports.verifyParams = verifyParams;
module.exports.uploadToS3 = uploadToS3;
module.exports.getApiId = getApiId;
