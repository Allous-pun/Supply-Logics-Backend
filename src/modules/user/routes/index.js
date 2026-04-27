const express = require('express');
const router = express.Router();
const { 
  addEmployee, 
  getAllEmployees, 
  getEmployeeById, 
  updateEmployee, 
  deleteEmployee,
  regenerateEmployeeCode
} = require('../controllers/user.controller');

router.post('/employees', addEmployee);
router.get('/organizations/:orgCode/employees', getAllEmployees);
router.get('/employees/:id', getEmployeeById);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);
router.post('/employees/:id/regenerate-code', regenerateEmployeeCode);

module.exports = router;
