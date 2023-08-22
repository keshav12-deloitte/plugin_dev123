import * as vscode from "vscode";
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import FormData = require("form-data");

import { sendAPIRequest } from './apiService';
import { url } from "inspector";

let panel: vscode.WebviewPanel | undefined;
let responseData : any;
let formattedData : any;
let beautifyData;

interface SimilarCodeEntry {
  "File Name": string;
  "Class Name": string;
  "Similar code": string;
}

interface MethodEntry {
  "method name": string;
  "Similar code": SimilarCodeEntry[];
}
export function activate(context: vscode.ExtensionContext) {
  // Create a command to activate the plugin 
  const commandId = "duplicatechecker.helloWorld";
  const commandHandler = () => {
    // Your plugin activation logic here
    // ...
    vscode.window.showInformationMessage("Plugin activated!");
  };
  const disposable = vscode.commands.registerCommand(commandId, commandHandler);
  context.subscriptions.push(disposable);

  // Create a button in the current window
  const button = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  button.text = "Rajaji is here";
  button.command = commandId;
  button.show();

  // Create a new side window using the vscode.window object
  const options = {
    viewColumn: vscode.ViewColumn.Two, // Open in the side column
    preserveFocus: true,
    webviewOptions: {
      retainContextWhenHidden: true,
    },
  };
  panel = vscode.window.createWebviewPanel(
    "projectAnalyzer",
    "Rajaji is here",
    options
  );

  // Update the webview panel when a new file is opened
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      updateWebview(editor.document);
    }
  });

  // Check if there is an active text editor
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    updateWebview(editor.document);
  }
}

function updateWebview(document: vscode.TextDocument) {
  // Get the content of the current open file
  const content = document.getText();

  // Get the current workspace directory
  const workspaceDirectory = getCurrentWorkspaceDirectory();

  // Analyze the content of the file
  const linesOfCode = content.split("\n").length;

  // Get the language of the current document
  let language = document.languageId;

  // Display panel with some info 
  if (panel) {
    panel.webview.html = `
      <h1 style="color:#FFFFFF;text-align:center;" >DE-Dupe :The Duplicate Checker</h1>
      <h2 style="color:#00CC66;text-align:center;" >Welcome to our AI Tool called DE-Dupe which helps many software engineers to come out from the loop
      of finding duplicate code in their code base,Dont worry we are here to help you </h2>
      <h2 style="color:#FFFFFF;">Lets together fix the issue in the ${workspaceDirectory} directory</h2>
      <p>Lines of code in the current opened editor/file: ${linesOfCode}</p>
      <p>Programming Language in which it is written in: ${language}</p>
      <p>Loading the anlysis : sit back and relax </p>
    `;
  }

  // Send a POST request to the API
  const apiUrl = 'http://127.0.0.1:8000/singlescreen/';
  const contentTYPE = 'multipart/form-data';
  const formData = new FormData();
  formData.append('code_string', content);

  // Send post request
  sendAPIRequest(apiUrl, 'POST', undefined, formData, undefined, undefined, contentTYPE)
    .then((response) => {
      // Display the analysis results and API response in the webview panel
      if (panel) {
        panel.webview.postMessage({ command: 'hideLoadingGif' }); // Notify the webview to hide the loading GIF
        // panel.webview.
        if (response.status === 200) {
          responseData = JSON.stringify(response.data, null, 2);
          formattedData = responseData.split('\\n').join('\n');
          // panel.webview.html += `
          //   <pre>${formattedData}</pre>
          // `;
        } 
        else {
          const responseSTATUS = response.status;
          panel.webview.html += `
            <h3>We support only Python</h3>
            <h3>Response Status : ${responseSTATUS}</h3>
          `;
          
        }

        let beautifyData=convertStringToJson(formattedData)

        // panel.webview.html += `
        //     <pre>${beautifyData}</pre>
        //   `;

        const data = JSON.parse(beautifyData);
          // Assuming you have a vscode.WebviewPanel instance called 'panel'

          // Constructing the HTML content
          let htmlContent = '';
          for (const entry of data) {
            const methodName = entry["method name"];
            htmlContent += `<div>
            <h2>Method Name: ${methodName}</h2>
            <div>`;
            
            const similarCodeArray = entry["similar code"];
            htmlContent += "<p>Similar code:</p>";
            
            for (const similarCodeEntry of similarCodeArray) {
              const fileName = similarCodeEntry["File Name"];
              const className = similarCodeEntry["Class Name"];
              const similarCode = similarCodeEntry["Similar code"];
              
              htmlContent += `
              <div>
              <p>---------The above method is duplicated in below mentioned file,please check it -----------</p>
                <ol>
                  <li><p style="color:#8A2BE2;" >File Name: <a href="command:extension.openFile?${encodeURIComponent(fileName)}">${fileName}</a></p></li>
                  <li><p style="color:#8A2BE2;" >File Name: ${fileName}</p></li>
                  <li><p style="color:#8A2BE2;" >Class Name: ${className}</p></li>
                  <li><p style="color:#8A2BE2;" >Similar code: ${similarCode}</p></li>
                </ol>
              
              </div>
              `;
            }
          }

          panel.webview.html += htmlContent;
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      if(panel) {

        panel.webview.html +=  panel.webview.postMessage({ command: 'hideLoadingGif' }); // Notify the webview to hide the loading GIF
        panel.webview.html += `
        <h3>We are in error block a</h3>
        <h3>${error}</h3>
        `;
        
      }
    });
}

function getCurrentWorkspaceDirectory(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }
  return undefined;
}


function convertStringToJson(str: string) {
  const lines = str.split('\n');
  const result = [];
  let currentMethod : any;

  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('Method name')) {
          if (currentMethod) {
              result.push(currentMethod);
          }

          currentMethod = {
              'method name': line.split('=')[1].trim(),
              'similar code': []
          };
      } else if (line.startsWith('File Name')) {
          const similarCode = {
              'File Name': line.split('=')[1].trim(),
              'Class Name': lines[++i].split('=')[1].trim(),
              'Similar code': lines[++i].split('=')[1].trim()
          };

          currentMethod['similar code'].push(similarCode);
      }
  }

  if (currentMethod) {
      result.push(currentMethod);
  }

  return JSON.stringify(result, null, 2);
}

// const str = `...`; // Your string here
// console.log(convertStringToJson(str));