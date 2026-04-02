# GitHub Secrets Configuration

To enable the CI/CD pipelines, you need to add the following secret to your GitHub repository.

## 1. RENDER_DEPLOY_HOOK_URL
This secret is required for the **Continuous Deployment (CD)** pipeline to trigger a build on Render after your tests pass.

### How to get it:
1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Select your **Web Service**.
3. Go to **Settings**.
4. Scroll down to the **Deploy Hook** section.
5. Copy the **Deploy Hook URL**.

### How to add it to GitHub:
1. Go to your repository on GitHub.
2. Click on **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Name: `RENDER_DEPLOY_HOOK_URL`
5. Value: *Paste the URL you copied from Render.*
6. Click **Add secret**.

---

## Environment Variables during CI
The CI pipeline (`ci.yml`) is already configured to use automated service containers for **PostgreSQL** and **Redis**. It uses default test credentials internally, so you **do not** need to add `DATABASE_URL` or `REDIS_URL` to GitHub Secrets unless you want to use external persistent databases for testing.

**Internal CI Defaults:**
- `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/dsavisualizer_test?schema=public`
- `REDIS_URL`: `redis://localhost:6379`
- `JWT_SECRET`: `ci-test-secret-min-32-characters-long-string`
- `NODE_ENV`: `test`
