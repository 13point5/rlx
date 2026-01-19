## AWS Setup for SSH Key Storage

### Step 1: Create an IAM User

1. Go to **AWS Console** → **IAM** → **Users** → **Create user**
2. Enter a username like `rlx-api`
3. Click **Next**
4. Select **Attach policies directly**
5. Click **Create policy** to create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:rlx/user-ssh-key/*"
    }
  ]
}
```

**Note:** The `DescribeSecret` permission is optional but recommended. If you don't include it, the system will still work but will handle orphaned secrets less efficiently (it will try to create and handle the "already exists" error instead of checking first).

6. Name the policy `RLXSecretsManagerPolicy` and create it
7. Back in the user creation, refresh and attach `RLXSecretsManagerPolicy`
8. Click **Create user**

### Step 2: Create Access Keys

1. Click on the user you just created
2. Go to **Security credentials** tab
3. Under **Access keys**, click **Create access key**
4. Select **Application running outside AWS**
5. Click **Create access key**
6. **Copy both values** - you won't see the secret again!

### Step 3: Add Environment Variables

Add these to your `apps/api/.env` file:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your-access-key...
AWS_SECRET_ACCESS_KEY=...your-secret-key...
```

**Choose your region** - pick the one closest to you or your users:

- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)

### Step 4: Verify Setup

You can test the connection by restarting your API server and trying to generate/upload an SSH key from the Settings page.

---

**Summary of env vars needed:**

| Variable                | Description                    |
| ----------------------- | ------------------------------ |
| `AWS_REGION`            | AWS region (e.g., `us-east-1`) |
| `AWS_ACCESS_KEY_ID`     | IAM user access key            |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key            |
