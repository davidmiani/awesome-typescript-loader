import { ICompilerOptions, ICompilerInfo, IFile } from './host';
import * as colors from 'colors';
import * as _ from 'lodash';

export enum MessageType {
    Init = <any>'init',
    Compile = <any>'compile'
}

export interface IMessage {
    messageType: MessageType,
    payload: any
}

export interface IInitPayload {
    compilerOptions: ICompilerOptions;
    compilerInfo: ICompilerInfo;
}

export interface ICompilePayload {
    files: {[fileName: string]: IFile};
    resolutionCache: {[fileName: string]: ts.ResolvedModule};
}

export interface IEnv {
    options?: ICompilerOptions;
    compiler?: typeof ts;
    compilerInfo?: ICompilerInfo;
    host?: Host;
    files?: {[fileName: string]: IFile};
    resolutionCache?: {[fileName: string]: ts.ResolvedModule};
    program?: ts.Program;
    service?: ts.LanguageService;
}

let env: IEnv = {};

export class Host implements ts.LanguageServiceHost {

    getScriptFileNames() {
        return Object.keys(env.files);
    }

    getScriptVersion(fileName: string) {
        if (env.files[fileName]) {
            return env.files[fileName].version.toString();
        }
    }

    getScriptSnapshot(fileName) {
        let file = env.files[fileName];
        if (file) {
            return env.compiler.ScriptSnapshot.fromString(file.text);
        }
    }

    getCurrentDirectory() {
        return process.cwd();
    }

    getScriptIsOpen() {
        return true;
    }

    getCompilationSettings() {
        return env.options;
    }

    resolveModuleNames(moduleNames: string[], containingFile: string) {
        let resolvedModules: ts.ResolvedModule[] = [];

        for (let moduleName of moduleNames) {
            resolvedModules.push(
                env.resolutionCache[`${containingFile}::${moduleName}`]
            );
        }

        return resolvedModules;
    }

    getDefaultLibFileName(options) {
        return options.target === env.compiler.ScriptTarget.ES6 ?
            env.compilerInfo.lib6.fileName :
            env.compilerInfo.lib5.fileName;
    }

    log(message) {
        //console.log(message);
    }
}

function processInit(payload: IInitPayload) {
    env.compiler = require(payload.compilerInfo.compilerName);
    env.host = new Host();
    env.compilerInfo = payload.compilerInfo;
    env.options = payload.compilerOptions;
    env.service = env.compiler.createLanguageService(env.host, env.compiler.createDocumentRegistry());
}

function processCompile(payload: ICompilePayload) {
    let instanceName = env.options.instanceName || 'default';
    let silent = !!env.options.forkCheckerSilent;
    if (!silent) {
        console.log(colors.cyan(`[${ instanceName }] Checking started in a separate process...`));
    }

    let timeStart = +new Date();
    process.send({
        messageType: 'progress',
        payload: {
            inProgress: true
        }
    });

    env.files = payload.files;
    env.resolutionCache = payload.resolutionCache;
    let program = env.program = env.service.getProgram();
    let allDiagnostics = env.compiler.getPreEmitDiagnostics(program);
    if (allDiagnostics.length) {
        allDiagnostics.forEach(diagnostic => {
            let message = env.compiler.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            if (diagnostic.file) {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                console.error(`[${ instanceName }] ${colors.red(diagnostic.file.fileName)} (${line + 1},${character + 1}):\n    ${colors.red(message)}`);
            } else {
                console.error(colors.red(`[${ instanceName }] ${ message }`));
            }
        });
    } else {
        if (!silent) {
            let timeEnd = +new Date();
            console.log(
                colors.green(`[${ instanceName }] Ok, ${(timeEnd - timeStart) / 1000} sec.`)
            );
        }
    }

    process.send({
        messageType: 'progress',
        payload: {
            inProgress: false
        }
    });
}

process.on('message', function(msg: IMessage) {
    switch (msg.messageType) {
        case MessageType.Init:
            processInit(msg.payload);
            break;
        case MessageType.Compile:
            processCompile(msg.payload);
            break;
    }
});
