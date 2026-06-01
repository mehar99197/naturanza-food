const blogModel = require("../models/blogModel");

const getPosts = async (req, res) => {
  const posts = await blogModel.listPublished({ category: req.query.category || null });
  return res.json(posts);
};

const getPostBySlug = async (req, res) => {
  const post = await blogModel.findBySlug(req.params.slug);
  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }
  return res.json(post);
};

const getAllPosts = async (req, res) => {
  const posts = await blogModel.listAll();
  return res.json(posts);
};

const createPost = async (req, res) => {
  const id = await blogModel.createPost(req.body || {});
  return res.status(201).json({ message: "Post created successfully", id });
};

const updatePost = async (req, res) => {
  const updated = await blogModel.updatePost(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: "Post not found" });
  }
  return res.json({ message: "Post updated successfully" });
};

const deletePost = async (req, res) => {
  const deleted = await blogModel.deleteById(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Post not found" });
  }
  return res.json({ message: "Post deleted successfully" });
};

module.exports = {
  getPosts,
  getPostBySlug,
  getAllPosts,
  createPost,
  updatePost,
  deletePost,
};
