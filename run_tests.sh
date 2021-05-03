#!/bin/bash
set -xe
# TODO + how to use in Docker + put in CI/CD

# Python
python3 --version
# Yup, that's ugly, and it doesn't offer any clue on coverage.
export PYTHONPATH="$PWD/bin/:$PYTHONPATH"
for x in bin/lib/*.py; do
  python3 -m doctest -v "$x"
done
# TODO add flake in the loop?

# Javascript
