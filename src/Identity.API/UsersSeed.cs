namespace eShop.Identity.API;

public class UsersSeed(ILogger<UsersSeed> logger, UserManager<ApplicationUser> userManager) : IDbSeeder<ApplicationDbContext>
{
    // Helper method to create a user with standard properties
    private async Task<bool> CreateUserIfNotExistsAsync(string userName, string email, string password, string firstName, string lastName)
    {
        var user = await userManager.FindByNameAsync(userName);

        if (user == null)
        {
            user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                EmailConfirmed = true,
                CardHolderName = $"{firstName} {lastName}",
                CardNumber = "XXXXXXXXXXXX1881",
                CardType = 1,
                City = "Redmond",
                Country = "U.S.",
                Expiration = "12/24",
                Id = Guid.NewGuid().ToString(),
                LastName = lastName,
                Name = firstName,
                PhoneNumber = "1234567890",
                ZipCode = "98052",
                State = "WA",
                Street = "15703 NE 61st Ct",
                SecurityNumber = "123"
            };

            var result = await userManager.CreateAsync(user, password);

            if (!result.Succeeded)
            {
                logger.LogError("Failed to create user {UserName}: {Error}", userName, result.Errors.First().Description);
                return false;
            }

            logger.LogDebug("User {UserName} created successfully", userName);
            return true;
        }
        else
        {
            logger.LogDebug("User {UserName} already exists", userName);
            return false;
        }
    }

    public async Task SeedAsync(ApplicationDbContext context)
    {
        // Original users (alice and bob)
        await CreateUserIfNotExistsAsync("alice", "AliceSmith@email.com", "Pass123$", "Alice", "Smith");
        await CreateUserIfNotExistsAsync("bob", "BobSmith@email.com", "Pass123$", "Bob", "Smith");
        
        // Create demo user
        await CreateUserIfNotExistsAsync("demouser", "demouser@example.com", "Pass123$", "Demo", "User");

        // Create 18 additional test users with different prefixes
        string[] prefixes = { "test", "user", "customer", "employee", "guest", "member" };
        string standardPassword = "Pass123$";
        
        for (int i = 1; i <= 18; i++)
        {
            int prefixIndex = (i - 1) % prefixes.Length;
            string userName = $"{prefixes[prefixIndex]}{i}";
            string email = $"{userName}@example.com";
            string firstName = char.ToUpper(prefixes[prefixIndex][0]) + prefixes[prefixIndex].Substring(1);
            string lastName = $"User{i}";
            
            await CreateUserIfNotExistsAsync(userName, email, standardPassword, firstName, lastName);
        }
    }
}
