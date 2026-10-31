const express = require('express');
const Candidate = require('../models/Candidate');
const { requireAuth, allowRoles } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth, allowRoles('recruiter'));
router.get('/', async (_req,res) => { try { res.json(await Candidate.find().populate('createdBy','name email').sort({updatedAt:-1})); } catch { res.status(500).json({message:'Could not load candidates.'}); } });
router.post('/', async (req,res) => { try {
 const {name,email,jobRole,phone='',stage='Applied',resumeUrl='',notes=''}=req.body;
 if(!name||!email||!jobRole) return res.status(400).json({message:'Name, email and job role are required.'});
 const candidate=await Candidate.create({name,email,jobRole,phone,stage,resumeUrl,notes,createdBy:req.user._id}); res.status(201).json(candidate);
 } catch(e) { res.status(e.code===11000?409:400).json({message:e.code===11000?'This candidate is already tracked for this role.':'Could not create candidate.'}); } });
router.put('/:id', async(req,res)=>{ try { const allowed=['name','email','jobRole','phone','stage','resumeUrl','notes']; const updates={}; for(const k of allowed) if(req.body[k]!==undefined) updates[k]=req.body[k]; const item=await Candidate.findByIdAndUpdate(req.params.id,updates,{new:true,runValidators:true}); if(!item)return res.status(404).json({message:'Candidate not found.'}); res.json(item); } catch { res.status(400).json({message:'Could not update candidate.'}); } });
router.delete('/:id',async(req,res)=>{try{const item=await Candidate.findByIdAndDelete(req.params.id);if(!item)return res.status(404).json({message:'Candidate not found.'});res.json({message:'Candidate removed.'});}catch{res.status(400).json({message:'Invalid candidate ID.'});}});
module.exports=router;
