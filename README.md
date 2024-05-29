# Secure user authentication API utilizing 

1. **Google Login and email/password credentials.**
    
    ```markup
    http://localhost:3000/api/v1/login/google
    ```
    
2. **Implemented hashed password storage with bcrypt for enhanced security.**
3. **Enabled password reset functionality through email verification with a secure JWT token.**
    
    ```markup
    http://localhost:3000/api/v1/forget-password
    http://localhost:3000/api/v1/reset-password/:token
    ```
    
4.  **Integrated JWT for stateless authentication, ensuring secure access to API endpoints.**
5. **Enforced strong password complexity through a robust validator.**