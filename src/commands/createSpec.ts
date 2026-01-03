import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function createSpecCommand(
  missingSpecPath: string,
  sourcePath: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  try {
    // Read source file to analyze exports
    const sourceContent = await fs.readFile(sourcePath, 'utf-8');
    
    // Get file name without extension
    const baseName = path.basename(sourcePath, '.ts');
    const className = toPascalCase(baseName);
    
    // Generate spec content
    const specContent = generateSpecContent(baseName, className, sourcePath, sourceContent);
    
    // Ensure directory exists
    const specDir = path.dirname(missingSpecPath);
    await fs.mkdir(specDir, { recursive: true });
    
    // Write spec file
    await fs.writeFile(missingSpecPath, specContent, 'utf-8');
    
    outputChannel.appendLine(`Created spec file: ${missingSpecPath}`);
    
    // Open the new spec file
    const doc = await vscode.workspace.openTextDocument(missingSpecPath);
    await vscode.window.showTextDocument(doc);
    
    vscode.window.showInformationMessage(
      `Created ${path.basename(missingSpecPath)}`,
      'Open Source File'
    ).then(result => {
      if (result === 'Open Source File') {
        vscode.workspace.openTextDocument(sourcePath).then(doc => {
          vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        });
      }
    });
    
  } catch (error) {
    outputChannel.appendLine(`Error creating spec: ${error}`);
    vscode.window.showErrorMessage(`Failed to create spec file: ${error}`);
  }
}

function toPascalCase(str: string): string {
  return str
    .split(/[-._]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function generateSpecContent(
  baseName: string,
  className: string,
  sourcePath: string,
  sourceContent: string
): string {
  // Detect if it's a service, component, guard, etc.
  const isService = baseName.includes('service') || baseName.includes('Service');
  const isGuard = baseName.includes('guard') || baseName.includes('Guard');
  const isPipe = baseName.includes('pipe') || baseName.includes('Pipe');
  const isComponent = baseName.includes('component') || baseName.includes('Component');
  
  // Detect exported functions/classes
  const classMatch = sourceContent.match(/export\s+class\s+(\w+)/);
  const functionMatches = [...sourceContent.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)];
  const arrowFunctionMatches = [...sourceContent.matchAll(/export\s+const\s+(\w+)\s*=/g)];
  
  const exportedClass = classMatch?.[1];
  const exportedFunctions = [
    ...functionMatches.map(m => m[1]),
    ...arrowFunctionMatches.map(m => m[1])
  ];
  
  // Build import path (relative)
  const importPath = `./${baseName}`;
  
  let content = `import { `;
  
  if (exportedClass) {
    content += exportedClass;
    if (exportedFunctions.length > 0) {
      content += ', ' + exportedFunctions.join(', ');
    }
  } else if (exportedFunctions.length > 0) {
    content += exportedFunctions.join(', ');
  } else {
    content += className;
  }
  
  content += ` } from '${importPath}';\n\n`;
  
  // Add describe block
  content += `describe('${exportedClass || className}', () => {\n`;
  
  if (isService || isGuard) {
    // Add beforeEach for class instantiation
    content += `  let sut: ${exportedClass || className};\n\n`;
    content += `  beforeEach(() => {\n`;
    content += `    // TODO: Add mock dependencies\n`;
    content += `    sut = new ${exportedClass || className}();\n`;
    content += `  });\n\n`;
    
    content += `  describe('instantiation', () => {\n`;
    content += `    it('should create instance', () => {\n`;
    content += `      expect(sut).toBeDefined();\n`;
    content += `    });\n`;
    content += `  });\n\n`;
    
    content += `  // TODO: Add more test cases\n`;
  } else if (exportedFunctions.length > 0) {
    // Add tests for each exported function
    for (const fn of exportedFunctions) {
      content += `  describe('${fn}', () => {\n`;
      content += `    it('should work correctly', () => {\n`;
      content += `      // TODO: Implement test\n`;
      content += `      const result = ${fn}();\n`;
      content += `      expect(result).toBeDefined();\n`;
      content += `    });\n`;
      content += `  });\n\n`;
    }
  } else {
    content += `  it('should be defined', () => {\n`;
    content += `    // TODO: Implement test\n`;
    content += `    expect(true).toBe(true);\n`;
    content += `  });\n`;
  }
  
  content += `});\n`;
  
  return content;
}

