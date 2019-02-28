"use strict" 

const JiraClient = require("jira-connector")
const program = require("commander")
const config = require("./config.json")

const jira = new JiraClient(config.credentials)

function logError(err) {
    let errors = JSON.parse(err).body.errors
    let msg = JSON.parse(err).body.errorMessages.reduce((p,c) => p+c+" ", "")
    console.log("[An error happened]", Object.keys(errors).reduce((p,c) => p+errors[c]+" " , msg))
}

program
    .version("1.0")
    .usage("COMMAND [options]")

program 
    .command("log <alias> [time]")
    .option("-c, --comment <comment>", "Add a comment into the log")
    .action((alias, time, options) => {
        let conf = config.aliases[alias]
        if (conf === undefined) conf = { issueKey: alias }
        else if (time === undefined && conf.time === undefined) console.log(`There is no default time to log in [${alias}]. You need to specify one`)
        else {
            let payload = {
                issueKey: conf.issue,
                worklog: { timeSpent: time !== undefined ? time : conf.time, comment: options.comment ? options.comment : conf.comment }
            }
            jira.issue.addWorkLog(payload).then(ret => {
                console.log(`Worklog registered with id ${ret.id}. Ticket: ${payload.issueKey}, time spent: ${payload.worklog.timeSpent}`)
            }).catch(logError)
        }
    })

program 
    .command("rmlog <issueKey> <worklogId>")
    .action((issueKey, worklogId) => {
        jira.issue.deleteWorkLog({
            issueKey, worklogId
        }).then(ret => {
            console.log(`Worklog ${worklogId} removed from issue ${issueKey}`)
        }).catch(logError)
    })

program.parse(process.argv)
