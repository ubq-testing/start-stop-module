/* eslint-disable @typescript-eslint/no-explicit-any */
// This is disabled because logs should be able to log any type of data
// Normally this is forbidden

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../types/database";

import { COMMIT_HASH } from "../../../handlers/shared/commit-hash";
import { LogLevel, PrettyLogs } from "../pretty-logs";
import { Context } from "../../../types/context";

type LogFunction = (message: string, metadata?: any) => void;
type LogInsert = Database["public"]["Tables"]["logs"]["Insert"];
type LogParams = {
  level: LogLevel;
  consoleLog: LogFunction;
  logMessage: string;
  metadata?: any;
  postComment?: boolean;
  type: PublicMethods<Logs>;
};
export class LogReturn {
  logMessage: LogMessage;
  metadata?: any;

  constructor(logMessage: LogMessage, metadata?: any) {
    this.logMessage = logMessage;
    this.metadata = metadata;
  }
}

type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type PublicMethods<T> = Exclude<FunctionPropertyNames<T>, "constructor" | keyof object>;

export type LogMessage = { raw: string; diff: string; level: LogLevel; type: PublicMethods<Logs> };

export class Logs {
  private _supabase: SupabaseClient;
  private _context: Context | null = null;

  private _maxLevel = -1;
  private _queue: LogInsert[] = []; // Your log queue
  private _concurrency = 6; // Maximum concurrent requests
  private _retryDelay = 1000; // Delay between retries in milliseconds
  private _throttleCount = 0;
  private _retryLimit = 0; // Retries disabled by default

  static console: PrettyLogs;

  private _log({ level, consoleLog, logMessage, metadata, postComment, type }: LogParams): LogReturn | null {
    if (this._getNumericLevel(level) > this._maxLevel) return null; // filter out more verbose logs according to maxLevel set in config

    console.log("Logging:", logMessage, metadata);
    // needs to generate three versions of the information.
    // they must all first serialize the error object if it exists
    // - the comment to post on supabase (must be raw)
    // - the comment to post on github (must include diff syntax)
    // - the comment to post on the console (must be colorized)

    consoleLog(logMessage, metadata || undefined);

    if (this._context && postComment) {
      console.log("Posting comment");
      const colorizedCommentMessage = this._diffColorCommentMessage(type, logMessage);
      const commentMetaData = metadata ? Logs._commentMetaData(metadata, level) : null;
      this._postComment(metadata ? [colorizedCommentMessage, commentMetaData].join("\n") : colorizedCommentMessage);
    }

    const toSupabase = { log: logMessage, level, metadata } as LogInsert;

    this._save(toSupabase);

    return new LogReturn(
      {
        raw: logMessage,
        diff: this._diffColorCommentMessage(type, logMessage),
        type,
        level,
      },
      metadata
    );
  }
  private _addDiagnosticInformation(metadata: any) {
    // this is a utility function to get the name of the function that called the log
    // I have mixed feelings on this because it manipulates metadata later possibly without the developer understanding why and where,
    // but seems useful for the metadata parser to understand where the comment originated from

    if (!metadata) {
      metadata = {};
    }
    if (typeof metadata == "string" || typeof metadata == "number") {
      // TODO: think i need to support every data type
      metadata = { message: metadata };
    }

    const stackLines = new Error().stack?.split("\n") || [];
    if (stackLines.length > 3) {
      const callerLine = stackLines[3]; // .replace(process.cwd(), "");
      const match = callerLine.match(/at (\S+)/);
      if (match) {
        metadata.caller = match[1];
      }
    }

    const gitCommit = COMMIT_HASH?.substring(0, 7) ?? null;
    metadata.revision = gitCommit;

    return metadata;
  }

  public ok(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.INFO,
      consoleLog: Logs.console.ok,
      logMessage: log,
      metadata,
      postComment,
      type: "ok",
    });
  }

  public warn(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.ERROR,
      consoleLog: Logs.console.warn,
      logMessage: log,
      metadata,
      postComment,
      type: "warn",
    });
  }

  public info(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.INFO,
      consoleLog: Logs.console.info,
      logMessage: log,
      metadata,
      postComment,
      type: "info",
    });
  }

  public error(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.ERROR,
      consoleLog: Logs.console.error,
      logMessage: log,
      metadata,
      postComment,
      type: "error",
    });
  }

  public debug(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.DEBUG,
      consoleLog: Logs.console.debug,
      logMessage: log,
      metadata,
      postComment,
      type: "debug",
    });
  }

  public fatal(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    if (!metadata) {
      metadata = Logs.convertErrorsIntoObjects(new Error(log));
      const stack = metadata.stack as string[];
      stack.splice(1, 1);
      metadata.stack = stack;
    }
    if (metadata instanceof Error) {
      metadata = Logs.convertErrorsIntoObjects(metadata);
      const stack = metadata.stack as string[];
      stack.splice(1, 1);
      metadata.stack = stack;
    }

    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.FATAL,
      consoleLog: Logs.console.fatal,
      logMessage: log,
      metadata,
      postComment,
      type: "fatal",
    });
  }

  verbose(log: string, metadata?: any, postComment?: boolean): LogReturn | null {
    metadata = this._addDiagnosticInformation(metadata);
    return this._log({
      level: LogLevel.VERBOSE,
      consoleLog: Logs.console.verbose,
      logMessage: log,
      metadata,
      postComment,
      type: "verbose",
    });
  }

  constructor(supabase: SupabaseClient, retryLimit: number, logLevel: keyof typeof LogLevel, context: Context | null) {
    this._supabase = supabase;
    this._context = context;
    this._retryLimit = retryLimit;
    this._maxLevel = this._getNumericLevel(logLevel as LogLevel);
    Logs.console = new PrettyLogs();
  }

  private async _sendLogsToSupabase(log: LogInsert) {
    const { error } = await this._supabase.from("logs").insert(log);
    if (error) throw Logs.console.fatal("Error logging to Supabase:", error);
  }

  private async _processLogs(log: LogInsert) {
    try {
      await this._sendLogsToSupabase(log);
    } catch (error) {
      Logs.console.fatal("Error sending log, retrying:", error);
      return this._retryLimit > 0 ? await this._retryLog(log) : null;
    }
  }

  private async _retryLog(log: LogInsert, retryCount = 0) {
    if (retryCount >= this._retryLimit) {
      Logs.console.fatal("Max retry limit reached for log:", log);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, this._retryDelay));

    try {
      await this._sendLogsToSupabase(log);
    } catch (error) {
      Logs.console.fatal("Error sending log (after retry):", error);
      await this._retryLog(log, retryCount + 1);
    }
  }

  private async _processLogQueue() {
    while (this._queue.length > 0) {
      const log = this._queue.shift();
      if (!log) {
        continue;
      }
      await this._processLogs(log);
    }
  }

  private async _throttle() {
    if (this._throttleCount >= this._concurrency) {
      return;
    }

    this._throttleCount++;
    try {
      await this._processLogQueue();
    } finally {
      this._throttleCount--;
      if (this._queue.length > 0) {
        await this._throttle();
      }
    }
  }

  private async _addToQueue(log: LogInsert) {
    this._queue.push(log);
    if (this._throttleCount < this._concurrency) {
      await this._throttle();
    }
  }

  private _save(logInsert: LogInsert) {
    this._addToQueue(logInsert)
      .then(() => void 0)
      .catch(() => Logs.console.fatal("Error adding logs to queue"));

    Logs.console.ok(logInsert.log, logInsert);
  }

  static _commentMetaData(metadata: any, level: LogLevel) {
    const prettySerialized = JSON.stringify(metadata, null, 2);
    // first check if metadata is an error, then post it as a json comment
    // otherwise post it as an html comment
    if (level === LogLevel.FATAL) {
      return ["```json", prettySerialized, "```"].join("\n");
    } else {
      return ["<!--", prettySerialized, "-->"].join("\n");
    }
  }

  private _diffColorCommentMessage(type: string, message: string) {
    const diffPrefix = {
      fatal: "-", // - text in red
      ok: "+", // + text in green
      error: "!", // ! text in orange
      info: "#", // # text in gray
      // debug: "@@@@",// @@ text in purple (and bold)@@
      // error: null,
      // warn: null,
      // info: null,
      // verbose: "#",
      // debug: "#",
    };
    const selected = diffPrefix[type as keyof typeof diffPrefix];

    if (selected) {
      message = message
        .trim() // Remove leading and trailing whitespace
        .split("\n")
        .map((line) => `${selected} ${line}`)
        .join("\n");
    } else if (type === "debug") {
      // debug has special formatting
      message = message
        .split("\n")
        .map((line) => `@@ ${line} @@`)
        .join("\n"); // debug: "@@@@",
    } else {
      // default to gray
      message = message
        .split("\n")
        .map((line) => `# ${line}`)
        .join("\n");
    }

    const diffHeader = "```diff";
    const diffFooter = "```";

    return [diffHeader, message, diffFooter].join("\n");
  }

  private _postComment(message: string) {
    console.log("Posting comment:", message);
    // post on issue
    if (!this._context) return;
    const { payload } = this._context;
    const { issue } = payload as Context<"issue_comment.created">["payload"];

    this._context.octokit.issues
      .createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: issue.number,
        body: message,
      })
      .catch((x) => console.trace(x));
  }

  private _getNumericLevel(level: LogLevel) {
    switch (level) {
      case LogLevel.FATAL:
        return 0;
      case LogLevel.ERROR:
        return 1;
      case LogLevel.INFO:
        return 2;
      case LogLevel.VERBOSE:
        return 4;
      case LogLevel.DEBUG:
        return 5;
      default:
        return -1; // Invalid level
    }
  }
  static convertErrorsIntoObjects(obj: any): any {
    // this is a utility function to render native errors in the console, the database, and on GitHub.
    if (obj instanceof Error) {
      return {
        message: obj.message,
        name: obj.name,
        stack: obj.stack ? obj.stack.split("\n") : null,
      };
    } else if (typeof obj === "object" && obj !== null) {
      const keys = Object.keys(obj);
      keys.forEach((key) => {
        obj[key] = this.convertErrorsIntoObjects(obj[key]);
      });
    }
    return obj;
  }
}
