"use strict" 

const JiraClient = require("jira-connector")
const program = require("commander")
const config = require("./config.json")
const Table = require("cli-table")

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
    .command("log add <alias> [time]")
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
    .command("log rm <issueKey> <worklogId>")
    .action((issueKey, worklogId) => {
        jira.issue.deleteWorkLog({
            issueKey, worklogId
        }).then(ret => {
            console.log(`Worklog ${worklogId} removed from issue ${issueKey}`)
        }).catch(logError)
    })

program
    .command("issues list")
    .action(() => {
        jira.search.search({
            jql: "assignee=currentUser() and (project=PA or project=PAA)"
        }).then(ret => {
            let table = new Table({
                head: ["Key", "Summary"]
            })

            for (let issue of ret.issues) {
                table.push([issue.key, issue.fields.summary])
            } 
            console.log(table.toString()) 
        })
        .catch(ret => { console.log(ret) })
    })

program
    .command("sprint")
    .option("--open", "Filter out closed issues")
    .option("--last", "Show the last sprint")
    .option("--next", "Show the next sprint")
    .option("--mine", "Show only issues assigned to you")
    .action((opt) => {
        jira.board.getSprintsForBoard({ boardId: 334, state: opt.last ? "closed" : (opt.next ? "future" : "active") }).then(s => {
            let sprint = opt.future ? s.values.shift() : s.values.pop()
            let jql = []
            if (opt.open) jql.push("statusCategory != done")
            if (opt.mine) jql.push("assignee = currentUser()")
            jira.sprint.getSprintIssues({
                sprintId: sprint.id,
                maxResults: 9999,
                jql: jql.join(" AND ")
            }).then(s => {
                let table = new Table({
                    head: ["Key", "Summary", "Assignee", "Points", "State"]
                })
                let points = 0
                for (let issue of s.issues) {
                    table.push([
                        issue.key,
                        issue.fields.summary,
                        issue.fields.assignee.name,
                        issue.fields.customfield_10105 || 0,
                        issue.fields.status.name
                    ])
                    points += issue.fields.customfield_10105 || 0
                }
                table.push(["", "", "", points, ""])
                console.log(table.toString())
            })
        })
        
    })

program.parse(process.argv)
