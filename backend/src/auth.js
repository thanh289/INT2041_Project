import jwt from "jsonwebtoken";

export function signToken(config, user) {
  const payload = {
    sub: user.id,
    unique_name: user.username,
    given_name: user.username,
  };

  return jwt.sign(payload, config.jwt.key, {
    algorithm: "HS512",
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: "30m",
  });
}

export function requireAuth(config) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.slice("bearer ".length).trim();
    try {
      const decoded = jwt.verify(token, config.jwt.key, {
        algorithms: ["HS512"],
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });

      const userId = decoded?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      req.user = {
        id: String(userId),
        username: decoded.unique_name ?? decoded.given_name,
      };

      return next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };
}
