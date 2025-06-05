#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AutoBotClaudeCode {
    constructor() {
        this.projectRoot = process.cwd();
        this.mcpDataPath = path.join(this.projectRoot, 'autoclaude_mcp');
        this.tasksPath = path.join(this.projectRoot, 'shrimp-data', 'tasks');
        this.logsPath = path.join(this.projectRoot, 'shrimp-data', 'logs');
        this.reportPath = path.join(this.projectRoot, 'CLAUDE_PROGRESS_REPORT.md');
    }

    async readClaudeMessages() {
        const messages = [];
        
        // Read autoclaude logs
        if (fs.existsSync(this.mcpDataPath)) {
            const logFile = path.join(this.mcpDataPath, 'autoclaude.log');
            if (fs.existsSync(logFile)) {
                try {
                    const logContent = fs.readFileSync(logFile, 'utf8');
                    const lines = logContent.split('\n').filter(line => line.trim());
                    messages.push(...lines.map(line => ({
                        source: 'autoclaude.log',
                        content: line,
                        timestamp: this.extractTimestamp(line)
                    })));
                } catch (error) {
                    console.error('Error reading autoclaude.log:', error);
                }
            }
        }

        // Read shrimp task logs
        if (fs.existsSync(this.logsPath)) {
            const logFiles = fs.readdirSync(this.logsPath).filter(f => f.endsWith('.log'));
            for (const file of logFiles) {
                try {
                    const content = fs.readFileSync(path.join(this.logsPath, file), 'utf8');
                    messages.push({
                        source: `shrimp-logs/${file}`,
                        content: content,
                        timestamp: fs.statSync(path.join(this.logsPath, file)).mtime
                    });
                } catch (error) {
                    console.error(`Error reading ${file}:`, error);
                }
            }
        }

        return messages;
    }

    async analyzeTasks() {
        const tasks = {
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            details: []
        };

        // Read shrimp tasks
        if (fs.existsSync(this.tasksPath)) {
            const taskFiles = fs.readdirSync(this.tasksPath).filter(f => f.endsWith('.json'));
            for (const file of taskFiles) {
                try {
                    const taskData = JSON.parse(fs.readFileSync(path.join(this.tasksPath, file), 'utf8'));
                    tasks.total++;
                    
                    const taskInfo = {
                        name: file.replace('.json', ''),
                        status: taskData.status || 'unknown',
                        description: taskData.description || '',
                        created: taskData.created || fs.statSync(path.join(this.tasksPath, file)).birthtime,
                        modified: fs.statSync(path.join(this.tasksPath, file)).mtime
                    };

                    if (taskInfo.status === 'completed') tasks.completed++;
                    else if (taskInfo.status === 'in_progress') tasks.inProgress++;
                    else if (taskInfo.status === 'pending') tasks.pending++;

                    tasks.details.push(taskInfo);
                } catch (error) {
                    console.error(`Error reading task ${file}:`, error);
                }
            }
        }

        return tasks;
    }

    async analyzeGitStatus() {
        try {
            const { stdout: status } = await execPromise('git status --porcelain');
            const { stdout: branch } = await execPromise('git branch --show-current');
            const { stdout: lastCommit } = await execPromise('git log -1 --oneline');

            const modifiedFiles = status.split('\n').filter(line => line.trim());
            
            return {
                branch: branch.trim(),
                lastCommit: lastCommit.trim(),
                modifiedFiles: modifiedFiles.length,
                files: modifiedFiles.map(line => ({
                    status: line.substring(0, 2).trim(),
                    file: line.substring(3)
                }))
            };
        } catch (error) {
            console.error('Error getting git status:', error);
            return null;
        }
    }

    extractTimestamp(logLine) {
        // Try to extract timestamp from log line
        const timestampPatterns = [
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
            /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
            /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/
        ];

        for (const pattern of timestampPatterns) {
            const match = logLine.match(pattern);
            if (match) return new Date(match[0].replace(/[\[\]]/g, ''));
        }

        return new Date();
    }

    async generateProgressReport() {
        console.log('🤖 AutoBotClaudeCode - Analyzing Claude messages and project status...');

        const messages = await this.readClaudeMessages();
        const tasks = await this.analyzeTasks();
        const gitStatus = await this.analyzeGitStatus();
        const timestamp = new Date().toISOString();

        let report = `# Claude Progress Report\n\n`;
        report += `📅 Generated: ${timestamp}\n\n`;

        // Executive Summary
        report += `## 📊 Executive Summary\n\n`;
        report += `- **Total Messages Analyzed**: ${messages.length}\n`;
        report += `- **Tasks**: ${tasks.completed}/${tasks.total} completed\n`;
        report += `- **Current Branch**: ${gitStatus?.branch || 'unknown'}\n`;
        report += `- **Modified Files**: ${gitStatus?.modifiedFiles || 0}\n\n`;

        // Task Status
        report += `## 📋 Task Status\n\n`;
        report += `| Status | Count |\n`;
        report += `|--------|-------|\n`;
        report += `| ✅ Completed | ${tasks.completed} |\n`;
        report += `| 🔄 In Progress | ${tasks.inProgress} |\n`;
        report += `| ⏳ Pending | ${tasks.pending} |\n`;
        report += `| 📊 Total | ${tasks.total} |\n\n`;

        // Task Details
        if (tasks.details.length > 0) {
            report += `### Task Details\n\n`;
            for (const task of tasks.details.sort((a, b) => b.modified - a.modified)) {
                const status = task.status === 'completed' ? '✅' : 
                              task.status === 'in_progress' ? '🔄' : '⏳';
                report += `#### ${status} ${task.name}\n`;
                if (task.description) report += `- **Description**: ${task.description}\n`;
                report += `- **Modified**: ${task.modified.toLocaleString()}\n\n`;
            }
        }

        // Recent Messages
        report += `## 💬 Recent Claude Messages\n\n`;
        const recentMessages = messages
            .sort((a, b) => (b.timestamp || new Date()) - (a.timestamp || new Date()))
            .slice(0, 10);

        if (recentMessages.length > 0) {
            for (const msg of recentMessages) {
                report += `### ${msg.source}\n`;
                report += `\`\`\`\n${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}\n\`\`\`\n\n`;
            }
        } else {
            report += `*No recent messages found*\n\n`;
        }

        // Git Status
        if (gitStatus) {
            report += `## 🔧 Git Status\n\n`;
            report += `- **Branch**: ${gitStatus.branch}\n`;
            report += `- **Last Commit**: ${gitStatus.lastCommit}\n\n`;
            
            if (gitStatus.files.length > 0) {
                report += `### Modified Files\n\n`;
                report += `| Status | File |\n`;
                report += `|--------|------|\n`;
                for (const file of gitStatus.files.slice(0, 20)) {
                    report += `| ${file.status} | ${file.file} |\n`;
                }
                if (gitStatus.files.length > 20) {
                    report += `| ... | ${gitStatus.files.length - 20} more files |\n`;
                }
                report += `\n`;
            }
        }

        // Recommendations
        report += `## 🎯 Recommendations\n\n`;
        if (tasks.inProgress > 0) {
            report += `- Complete ${tasks.inProgress} in-progress task(s)\n`;
        }
        if (tasks.pending > 0) {
            report += `- Start working on ${tasks.pending} pending task(s)\n`;
        }
        if (gitStatus?.modifiedFiles > 10) {
            report += `- Consider committing changes (${gitStatus.modifiedFiles} files modified)\n`;
        }
        report += `\n`;

        // Save report
        fs.writeFileSync(this.reportPath, report);
        console.log(`✅ Progress report generated: ${this.reportPath}`);

        return report;
    }

    async run() {
        try {
            const report = await this.generateProgressReport();
            
            // Print summary to console
            console.log('\n📊 Summary:');
            const lines = report.split('\n');
            const summaryEnd = lines.findIndex(line => line.includes('## 📋 Task Status'));
            console.log(lines.slice(0, summaryEnd).join('\n'));
            
        } catch (error) {
            console.error('❌ Error generating report:', error);
            process.exit(1);
        }
    }
}

// Run the command
if (require.main === module) {
    const bot = new AutoBotClaudeCode();
    bot.run();
}

module.exports = AutoBotClaudeCode;