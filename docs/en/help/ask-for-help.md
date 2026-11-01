# Ask for help

This page explains how to report a problem or ask a question on the project's site, and what to write so that whoever
answers can understand what happened. It is for everyone who uses BiblioViva, after trying the solutions in
[Common problems](problems.md).

## Where to write

Reports are written on the project's issues page on GitHub:
[github.com/itotm/biblioviva/issues](https://github.com/itotm/biblioviva/issues). A free GitHub account is needed
([sign up](https://github.com/signup)). Before writing, search the list: the same problem may already have been
reported.

## What to write

A useful report contains four things.

1. The version of BiblioViva. It is read on the **About** page, at the **Version** row: the page opens from the account
   menu, at the top, or from the version number at the bottom of the sidebar.
1. What was being done, step by step, starting from the page where it began.
1. What appeared: the exact text of the message, copied or photographed, or a description of what was seen.
1. What was expected.

The type of computer (PC, Raspberry Pi), the way chosen for the installation (Tailscale or local network) and the
browser used also help.

<!-- figure: about/about | The About page with the version of BiblioViva -->

> [!IMPORTANT]
> A report is public: do not write or attach the names, surnames, photos or card numbers of patrons, nor any password
> or key (for example the Tailscale key or the content of the `.env` file). In photos of the screen, cover the names.
> To describe a case, words such as "a student" or "a copy" are enough.

## The diagnostic log

When the problem stays unclear, whoever installed BiblioViva can turn on the diagnostic log, which writes step by step
what the application does. The log contains no names, photos or card numbers, only codes, sizes and outcomes. The
procedure uses the terminal of the BiblioViva computer ([Connect to the computer](../setup/steps/terminal.md)).

1. Open the settings file with the terminal editor.

   ```sh
   nano ~/biblioviva/.env
   ```

1. Change the line `LOG_LEVEL=info` to `LOG_LEVEL=debug`. Save with Ctrl+O and Enter, then exit with Ctrl+X.
1. Restart BiblioViva with the new setting.

   ```sh
   cd ~/biblioviva && docker compose up -d
   ```

1. Repeat the operation that causes the problem.
1. Read the log lines that carry the word `debug`.

   ```sh
   cd ~/biblioviva && docker compose logs app | grep debug
   ```

1. Copy into the report the lines that concern the moment of the problem, and no others.
1. Put `LOG_LEVEL=info` back and repeat the command of step 3.

The areas of the log and the commands to read it are described in the technical page
[Deployment notes (technical)](../../deploy.md#installing-updating-logs-step-85).

## Related pages

- [Common problems](problems.md)
- [Glossary](glossary.md)
- [Help](README.md)
