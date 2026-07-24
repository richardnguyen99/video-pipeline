---
name: "Python Standards"
description: "Coding conventions for Python files"
applyTo: "**/*.py"
---

# Tech stack

- `python3.14` as the core programming language.
- `fastapi` as the web framework for building APIs and server-side applications.
- `sqlmodel` as the ORM for database interactions and model definitions.
- `postgresql` as the core database for the application.
- `redis` as the caching layer between application and database to improve performance and reduce database load.
- `celery` as the task queue for handling asynchronous tasks and background jobs.
- `rabbitmq` as the message broker for Celery to facilitate communication between the application and the task queue.
- `alembic` as the database migration tool for managing schema changes and versioning.
- `pytest` as the testing framework for writing and executing unit tests, integration tests, and end-to-end tests.
- `pytest-asyncio` as the plugin for pytest to support testing of asynchronous code and coroutines.
- `black` as the code formatter.
- `isort` as the import sorting tool.
- `pylint` as the static code analysis tool.
- `pre-commit` as the tool for managing and maintaining pre-commit hooks to enforce code quality and consistency.

# Coding conventions

- ALWAYS use virtual environments for managing project dependencies.
- Use `requirements.txt` to manage project dependencies.
- Follow PEP 8 guidelines for code style and formatting.
- Write docstrings for all public modules, classes, and functions following the PEP 257 conventions.
- Use type hints for function arguments and return types.
- Prefer using f-strings for string formatting.
- Keep lines under 79 characters to maintain code readability.
- Use blank lines to separate top-level function and class definitions.
- Avoid using mutable default arguments in function definitions.
- Use list comprehensions and generator expressions for concise and readable code when appropriate.
- Prefer using `with` statements for resource management to ensure proper cleanup.
- Avoid using bare `except` clauses; catch specific exceptions to handle errors appropriately.
- Use `async/await` syntax for asynchronous programming to write non-blocking code.
- Use `isort` to automatically sort imports for better readability and maintainability.
- Use `black` to automatically format code according to PEP 8 standards.
- Use `pylint` to perform static code analysis and enforce coding standards.
- Use 4 spaces for indentation instead of tabs.
- Use double quotes for strings.
- Always add a trailing comma after the last element in a list, tuple, or dictionary.
- Always add a trailing comma after the last argument in a function call.
- Always add a trailing comma after the last argument in an object instantiation.
- Add an empty line after docstrings in functions and classes
- Add an empty line before return statements in functions

# FAST API

- Use `FastAPI` for building APIs.
- Follow the official FastAPI documentation for best practices and recommended patterns.
- Use Pydantic models for request validation and response serialization.
- Use asynchronous endpoints whenever possible to improve performance and scalability.
- Each leaf route should be a separate file.
- Non-leaf routes should be a folder containing the relevant leaf route files. and should include an `__init__.py` file to make it a proper Python package.
- Use routers to organize and modularize your API endpoints.
- Use named status codes instead of numeric literals

# Routing

- Define routes clearly and consistently.
- Use meaningful and descriptive route names.
- Group related routes together using routers.
- Keep route handlers focused on handling HTTP requests and responses, delegating business logic to separate service layers.
- The same route can have multiple HTTP methods (GET, POST, PUT, DELETE) defined separately in the same route handler file.

# ORM and Models

- Use PostgresQL as the core database for the application.
- Use SQLModel as the core ORM for defining database models and interacting with the database.
- Define each model in a separate file to maintain modularity and readability.
- Use relationships to define associations between models where appropriate.
- Avoid raw SQL queries; prefer using the ORM's query capabilities for database interactions.
- Use migrations to manage database schema changes consistently.
- Support type hints for model fields
- Declare static methods using the `@staticmethod` decorator inside model classes for model-related utility functions such as `User.get_by_id()`.
- Use class methods with the `@classmethod` decorator for operations that involve the class itself rather than an instance, such as `User.create()`.
- Use the `__repr__` method to provide a meaningful string representation of model instances for debugging and logging purposes.
- Prefer `sqlmodel`'s methods, functions, and types to native Python likes. For example, use `sqlmodel.sql.sqltypes.AutoString` instead of `str` for string fields in models to leverage the ORM's capabilities and ensure compatibility with the database.
- Use asynchronous database sessions and methods to work with the database in a non-blocking manner.
- Use `sqlmodel.ext.asyncio.session.AsyncSession` to type-hint the session parameter in model methods that interact with the database.
- Use `async` to declare asynchronous methods that work with async sessions and `await` to call asynchronous methods within those methods.
- Add cascade delete to relationships where appropriate.
