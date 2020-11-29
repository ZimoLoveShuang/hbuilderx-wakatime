const hx = require("hbuilderx");

const os = require('os')
const fs = require('fs')
const path = require('path')
const ini = require('ini')
const request = require('request')

const plugin_name = 'HbuilderX-wakatime'
const plugin_version = '1.0.3'
const ide = hx.env.appName
const ide_version = hx.env.appVersion
const config_path = path.format({
	dir: os.homedir(),
	base: '.wakatime.cfg'
})

var lastAction = 0
var lastFile = undefined
var debug = true
var partten = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/

// 读取api_key，如果不存在就创建
function read_api_key() {
	if (debug) console.log(config_path)
	try {
		config = ini.parse(fs.readFileSync(config_path, 'utf-8'))
		return config.settings.api_key
	} catch (e) {
		// 没有配置api_key
		hx.window.showInputBox({
			prompt: '请输入api_key'
		}).then((result) => {
			if (partten.test(result)) {
				var config = {
					settings: {
						api_key: ''
					}
				}
				config.settings.api_key = result
				fs.writeFileSync(config_path, ini.stringify(config))
				if (debug) console.log('the input api_key is ' + result)
				return result
			}
			return read_api_key()
		})
	}
}


function enoughTimePassed() {
	return lastAction + 120000 < Date.now();
}

// 发送心跳包
function sendHeartbeat(file, time, project, language, isWrite, lines) {
	var data = {
		entity: file,
		type: 'file',
		category: 'coding',
		time: time / 1000,
		project: project,
		language: language,
		lines: lines,
		is_write: isWrite ? true : false,
		plugin: plugin_name + '/' + plugin_version,
	}

	if (debug) console.log(JSON.stringify(data))
	request({
		url: 'https://api.wakatime.com/api/v1/users/current/heartbeats',
		method: 'POST',
		json: true,
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': ide + '/' + ide_version + ' (' + os.type() + ' ' + os.release() + ')',
			'Authorization': 'Basic ' + Buffer.from(api_key).toString('base64')
		},
		body: data
	}, function(error, response, body) {
		if (!error && response.statusCode == 201) {
			if (debug) console.log('send heartbeat success.')
		}
	})

	lastAction = time
	lastFile = file
}

function handleAction(isWrite) {
	api_key = read_api_key()
	hx.window.getActiveTextEditor()
		.then(function(editor) {
			var currentDocument = editor.document
			if (debug) console.log(currentDocument)
			var time = Date.now()
			if (isWrite || enoughTimePassed() || lastFile !== currentDocument.uri.fsPath) {
				var language = currentDocument.languageId ? currentDocument.languageId : undefined
				var project = currentDocument.workspaceFolder.name ? currentDocument.workspaceFolder.name : undefined
				var lines = currentDocument.lineCount ? currentDocument.lineCount : undefined
				sendHeartbeat(currentDocument.uri.fsPath, time, project, language, isWrite, lines, api_key)
			}
		})
}

//该方法将在插件激活的时候调用
function activate(context) {
	if (debug) console.log('hbuilderx-wakatime started.')
	if (debug) console.log('hbuilderx-wakatime init.')
	if (debug) console.log('check api_key')
	var api_key = read_api_key()
	if (debug) console.log('the api_key is ' + api_key)
	if (partten.test(api_key))
		hx.window.showInformationMessage(
			'hbuilderx-wakatime init success. <a href="https://github.com/ZimoLoveShuang/hbuilderx-wakatime">plugin details</a>'
		);
	if (debug) console.log('binding to ide events.')
	hx.workspace.onDidChangeTextDocument(function(event) {
		let document = event.document;
		if (debug) console.log('文档被修改时的事件' + JSON.stringify(document))
		handleAction(true)
	})
	hx.workspace.onDidSaveTextDocument(function(document) {
		if (debug) console.log('文档被保存时的事件' + JSON.stringify(document))
		handleAction(true)
	})
	hx.workspace.onDidOpenTextDocument(function(document) {
		if (debug) console.log('文档被打开时的事件' + JSON.stringify(document))
		handleAction(true)
	})
}

//该方法将在插件禁用的时候调用（目前是在插件卸载的时候触发）
function deactivate() {
	if (debug) console.log('hbuilderx-wakatime stoped.')
}

module.exports = {
	activate,
	deactivate
}
