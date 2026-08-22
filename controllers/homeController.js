export const homePage = (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.render("home", { title: "Home" });
};
