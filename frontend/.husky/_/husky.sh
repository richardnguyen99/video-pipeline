#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "husky (debug) - $1"
    fi
  }

  readonly hook_name="$(basename -- "$0")"
  debug "husky - start"

  readonly husky_skip_init=1
  export husky_skip_init
  sh -e "$0" "$@"
  exit_code=$?

  if [ $exit_code -ne 0 ]; then
    echo "husky - $hook_name hook failed (exit code $exit_code)"
    exit $exit_code
  fi

  debug "husky - end"
fi
