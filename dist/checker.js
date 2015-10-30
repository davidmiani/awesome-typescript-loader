var colors = require('colors');
(function (MessageType) {
    MessageType[MessageType["Init"] = 'init'] = "Init";
    MessageType[MessageType["Compile"] = 'compile'] = "Compile";
})(exports.MessageType || (exports.MessageType = {}));
var MessageType = exports.MessageType;
var env = {};
var Host = (function () {
    function Host() {
    }
    Host.prototype.getScriptFileNames = function () {
        return Object.keys(env.files);
    };
    Host.prototype.getScriptVersion = function (fileName) {
        if (env.files[fileName]) {
            return env.files[fileName].version.toString();
        }
    };
    Host.prototype.getScriptSnapshot = function (fileName) {
        var file = env.files[fileName];
        if (file) {
            return env.compiler.ScriptSnapshot.fromString(file.text);
        }
    };
    Host.prototype.getCurrentDirectory = function () {
        return process.cwd();
    };
    Host.prototype.getScriptIsOpen = function () {
        return true;
    };
    Host.prototype.getCompilationSettings = function () {
        return env.options;
    };
    Host.prototype.resolveModuleNames = function (moduleNames, containingFile) {
        var resolvedModules = [];
        for (var _i = 0; _i < moduleNames.length; _i++) {
            var moduleName = moduleNames[_i];
            resolvedModules.push(env.resolutionCache[(containingFile + "::" + moduleName)]);
        }
        return resolvedModules;
    };
    Host.prototype.getDefaultLibFileName = function (options) {
        return options.target === 2 ?
            env.compilerInfo.lib6.fileName :
            env.compilerInfo.lib5.fileName;
    };
    Host.prototype.log = function (message) {
    };
    return Host;
})();
exports.Host = Host;
function processInit(payload) {
    env.compiler = require(payload.compilerInfo.compilerName);
    env.host = new Host();
    env.compilerInfo = payload.compilerInfo;
    env.options = payload.compilerOptions;
    env.service = env.compiler.createLanguageService(env.host, env.compiler.createDocumentRegistry());
}
function processCompile(payload) {
    var instanceName = env.options.instanceName || 'default';
    var silent = !!env.options.forkCheckerSilent;
    if (!silent) {
        console.log(colors.cyan("[" + instanceName + "] Checking started in a separate process..."));
    }
    var timeStart = +new Date();
    process.send({
        messageType: 'progress',
        payload: {
            inProgress: true
        }
    });
    env.files = payload.files;
    env.resolutionCache = payload.resolutionCache;
    var program = env.program = env.service.getProgram();
    var allDiagnostics = env.compiler.getPreEmitDiagnostics(program);
    if (allDiagnostics.length) {
        allDiagnostics.forEach(function (diagnostic) {
            var message = env.compiler.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            if (diagnostic.file) {
                var _a = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start), line = _a.line, character = _a.character;
                console.error("[" + instanceName + "] " + colors.red(diagnostic.file.fileName) + " (" + (line + 1) + "," + (character + 1) + "):\n    " + colors.red(message));
            }
            else {
                console.error(colors.red("[" + instanceName + "] " + message));
            }
        });
    }
    else {
        if (!silent) {
            var timeEnd = +new Date();
            console.log(colors.green("[" + instanceName + "] Ok, " + (timeEnd - timeStart) / 1000 + " sec."));
        }
    }
    process.send({
        messageType: 'progress',
        payload: {
            inProgress: false
        }
    });
}
process.on('message', function (msg) {
    switch (msg.messageType) {
        case MessageType.Init:
            processInit(msg.payload);
            break;
        case MessageType.Compile:
            processCompile(msg.payload);
            break;
    }
});
//# sourceMappingURL=checker.js.map