# `@ubiquibot-plugins/start-stop-plugin`

This plugin allows a hunter to begin a task as well as gracefully stop a task without incurring a negative impact on the hunter's XP or karma.

## Usage

### Start a task

To start a task, a hunter should use the `/start` command. This will assign them to the issue so long as the following is true:

- Price labels are set on the issue
- The issue is not already assigned
- The hunter has not reached the maximum number of concurrent tasks
- The command is not disabled at the repository or organization level
- TODO: If the hunter meets the required karma and XP requirements

### Stop a task

To stop a task, a hunter should use the `/stop` command. This will unassign them from the issue so long as the following is true:

- The hunter is assigned to the issue
- The command is not disabled at the repository or organization level
- The command is called on the issue, not the associated pull request

### [Configuration](./src/plugin-config.yml)

#### Note: The command name is `"start"` when configuring your `.ubiquibot-config.yml` file.

To configure your Ubiquibot to run this plugin, add the following to your [`.ubiquibot-config.yml`](./.github/.ubiquibot-config.yml) file at either the organization or repository level:

```yml
plugins:
  issue_comment.created:
    - uses:
        - plugin: ubiquibot-plugins/start-stop-plugin:compute.yml@development
          name: start-stop
          id: start-stop-command
          type: github
          description: "Allows a user to start/stop a bounty without negative XP impact"
          command: "/(start|stop)"
          example: "/start | /stop"
          with:
            disabledCommands: [] # Empty array means no commands are disabled
                - start # Disables the start command
            timers:
              reviewDelayTolerance: 86000
              taskStaleTimeoutDuration: 2580000
            miscellaneous:
              maxConcurrentTasks: 3
            labels:
              time: []
              priority: []

```
