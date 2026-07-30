# CLI

**What it is:** The CLI (command-line interface), or terminal, is a text window where you type commands to control your computer directly — no clicking, just typing.

## Why it matters for an AI Engineer

AI Engineers live in the terminal. You install packages, run training scripts, start servers, connect to cloud machines, and drive Git and Docker — all from the command line. Remote servers (where your models actually run) often have *no* graphical interface at all; the terminal is the only way in. Being fast and comfortable here is not optional. It is the environment you work in all day. The good news: a dozen commands cover 90% of daily use.

## Moving around: the filesystem

Your files are organized in folders (directories). These commands navigate them:

```bash
pwd                  # print working directory — where am I?
ls                   # list files in the current folder
ls -la               # list ALL files (incl. hidden) with details
cd projects          # change into the "projects" folder
cd ..                # go up one folder
cd ~                 # go to your home folder
cd /                 # go to the root of the filesystem
```

`pwd`, `ls`, `cd` are the three you will use constantly. Hidden files (like `.env`, `.git`) start with a dot and only show with `ls -la`.

## Making and removing things

```bash
mkdir rag-project            # make a directory
mkdir -p data/raw            # make nested dirs in one go
touch app.py                 # create an empty file
cp app.py backup.py          # copy a file
mv app.py src/app.py         # move (or rename) a file
rm backup.py                 # delete a file
rm -r old-project/           # delete a folder and its contents
```

`rm` has no undo and no trash bin — it is gone. Double-check before running it, especially `rm -r`.

## Reading files without opening an editor

```bash
cat config.yaml              # dump a whole file to the screen
head -n 20 data.csv          # first 20 lines
tail -n 20 log.txt           # last 20 lines
tail -f log.txt              # follow a log live as it grows
grep "error" log.txt         # find lines containing "error"
```

`grep` searches text. `tail -f` on a log is how you watch a running model or server in real time.

## Pipes: chaining commands together

A **pipe** (`|`) sends the output of one command into another. This is the superpower of the terminal — small tools combined into exactly what you need.

```bash
cat access.log | grep "500" | wc -l      # count lines containing "500"
ls -la | grep ".py"                      # list only python files
history | grep git                       # find past git commands you ran
```

Read it left to right: list/print → filter → count. Each piece does one job; the pipe glues them.

## Running scripts and programs

```bash
python app.py                # run a python script
python train.py --epochs 5   # pass arguments to it
pip install requests         # install a package
./deploy.sh                  # run a shell script (must be executable)
chmod +x deploy.sh           # make a script executable
```

Arguments after the command (like `--epochs 5`) configure how it runs. This is how you kick off training jobs, start servers, and run your tools.

## A real company example

An AI Engineer at a Dubai analytics firm SSHs into a cloud GPU server that has no desktop — pure terminal. She `cd`s into the project, pulls the latest code with `git pull`, starts training with `python train.py --config prod.yaml`, and watches progress live with `tail -f logs/train.log`. When something looks off, she runs `cat logs/train.log | grep "loss" | tail -20` to see the recent loss values. Everything — deploy, run, monitor, debug — happens through commands. Without the terminal, she could not touch that machine at all.

## Common mistakes and gotchas

- **`rm -r` on the wrong folder.** No undo. Run `pwd` and `ls` first to confirm where you are.
- **Spaces in filenames.** `cd my folder` fails. Quote it: `cd "my folder"`, or avoid spaces entirely.
- **Not knowing where you are.** Commands act on the current folder. Lost? `pwd` and `ls`.
- **Copy-pasting commands you do not understand.** Especially anything with `sudo` or `rm`. Read it first.
- **Forgetting Tab-completion.** Start typing a filename and press Tab — the terminal finishes it. Huge time-saver, fewer typos.

## Interview / practical tip

You will not be quizzed on `ls` in an interview, but comfort in the terminal shows in a live coding task — how quickly you navigate, run tests, and check logs. Practice until `cd`, `ls`, `grep`, and pipes are muscle memory. Fumbling in the terminal during a pairing session reads as inexperience; fluency reads as someone who has actually shipped software.
