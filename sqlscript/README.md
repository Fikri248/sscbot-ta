# SSC-BOT Database SQL Scripts

This folder contains SQL scripts to initialize and seed the SSC-BOT database (`ssc_bot`).

## Files

1. `001_create_database.sql` - Creates the database with proper charset.
2. `002_create_tables.sql` - Creates all required tables (`users`, `documents`, `document_chunks`, `chat_sessions`, `chat_messages`).
3. `003_insert_seed_data.sql` - Inserts a default admin user for initial login.
4. `004_full_setup.sql` - A combined script of the above three files for a quick 1-click setup.

## How to Run

### Option 1: MySQL CLI (Command Line)
You can run the full setup script from your terminal:
```bash
mysql -u root -p < sqlscript/004_full_setup.sql
```

### Option 2: phpMyAdmin
1. Open phpMyAdmin in your browser.
2. Select the `Import` tab.
3. Browse and select the `sqlscript/004_full_setup.sql` file.
4. Click `Go` / `Import` to execute.

### Option 3: Aiven MySQL Console
If you are deploying to Aiven MySQL:
1. Connect using the Aiven CLI or your preferred MySQL client (e.g. MySQL Workbench).
2. Execute the contents of `004_full_setup.sql`.
*Note: Do not commit your Aiven credentials.*

## Next Steps
After running the SQL script:
1. Configure your backend `.env` file to point to this database.
2. Run the backend and login using the default admin account.
3. Use the Admin Dashboard to sync or upload new documents, which will automatically populate the knowledge base and generate embeddings.

> **Important Security Note:**  
> These SQL scripts contain **no secrets**. API keys, JWT secrets, and database credentials must be configured securely in your `.env` files.

## Demo Credentials

After running the seed script, the following demo accounts are available:

| Role | Email/Login | Password | Access |
|------|-------------|----------|--------|
| Admin | `admin` | `admin123` | Admin dashboard, document management, sync, and query testing |
| User | `kelompok4@sscbot` | `kelompok4` | Student/user chatbot interface |

> These credentials are for demo/testing only.
