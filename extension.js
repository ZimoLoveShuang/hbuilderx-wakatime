const hx = require("hbuilderx");

const os = require('os')
const fs = require('fs')
const path = require('path')
const ini = require('ini')
const request = require('request')

const plugin_name = 'wakatime-hbuilderx'
const plugin_version = '1.0.0'
const ide = hx.env.appName
const ide_version = hx.env.appVersion
const config_path = path.format({
	dir: os.homedir(),
	base: '.wakatime.cfg'
})

var lastAction = 0,
	lastFile = undefined;

// 读取api_key，如果不存在就创建
function read_api_key() {
	// console.log(config_path)
	try {
		config = ini.parse(fs.readFileSync(config_path, 'utf-8'))
		return config.settings.api_key
	} catch (e) {
		// 没有配置api_key
		hx.window.showInputBox({
			prompt: '请输入api_key'
		}).then((result) => {
			var partten = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/
			if (partten.test(result)) {
				var config = {
					settings: {
						api_key: ''
					}
				}
				config.settings.api_key = result
				fs.writeFileSync(config_path, ini.stringify(config))
				console.log('the input api_key is ' + result)
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
function sendHeartbeat(file, time, project, language, isWrite, lines, api_key) {
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

	// console.log(JSON.stringify(data))
	request({
		url: 'https://api.wakatime.com/api/v1/users/current/heartbeats',
		method: 'POST',
		json: true,
		headers: {
			'content-type': 'application/json',
			'Authorization': 'Basic ' + Buffer.from(api_key).toString('base64')
		},
		body: data
	}, function(error, response, body) {
		if (!error && response.statusCode == 201) {
			console.log('send heartbeat success.')
		}
	})

	lastAction = time
	lastFile = file
}

function handleAction(isWrite, api_key) {
	hx.window.getActiveTextEditor()
		.then(function(editor) {
			var currentDocument = editor.document
			// console.log(currentDocument)
			var time = Date.now()
			if (isWrite || enoughTimePassed() || lastFile !== currentDocument.uri.fsPath) {
				hx.workspace.getWorkspaceFolder("%fsPath%").then(function(wsFolder) {
					var language = currentDocument.languageId ? currentDocument.languageId : undefined
					var project = wsFolder.name ? wsFolder.name : undefined
					var editor = ide
					var lines = currentDocument.lineCount ? currentDocument.lineCount : undefined
					sendHeartbeat(currentDocument.uri.fsPath, time, project, language, isWrite, lines, api_key)
				})
			}
		})
}

//该方法将在插件激活的时候调用
function activate(context) {
	console.log('wakatime-hbuilderx started.')
	console.log('wakatime init.')
	console.log('check api_key')
	var api_key = read_api_key()
	console.log('the api_key is ' + api_key)
	console.log('binding to ide events.')
	hx.workspace.onDidChangeTextDocument(function(event) {
		let document = event.document;
		// console.log('文档被修改时的事件' + JSON.stringify(document))
		handleAction(false, api_key)
	})
	hx.workspace.onDidSaveTextDocument(function(document) {
		// console.log('文档被保存时的事件' + JSON.stringify(document))
		handleAction(true, api_key)
	})
}

//该方法将在插件禁用的时候调用（目前是在插件卸载的时候触发）
function deactivate() {
	console.log('wakatime-hbuilderx stoped.')
}

module.exports = {
	activate,
	deactivate
}
