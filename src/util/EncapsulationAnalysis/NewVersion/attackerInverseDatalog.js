// Copyright (C) 2010 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Generates datalog constraints for the attacker
 * @Author
 Ankur Taly (ataly@stanford.edu)
 * @arguments
     - encode: encoding function (string -> nat)
     - getNextNumber: new number generator ( _ -> nat)
 * @provides genAttackerConstraints
 * Assumes:
 - assumes an annotation $A$AdsafeRejectNot
- Requires - genConstraintsScopeNumber;
 */
 this.genAttackerConstraints = function genAttackerConstraints(genConstraintsScopeNumber,annotationsObj, toBeCloned,  encodeVar, encodeField, encodeLoc, encodeCon, getNextTempVar, getNextAstNumber, astNumberMap, relName, makeConstraint,  functionClones, nClones, maxArity) {
     
     function copyVariableMap(obj){
	 var retAttr = {};
	 for (var p in obj){
	     // this function is a little sloppy as it relies on obj to have the shape {x~: {suffix: -- , count: --}}
		 retAttr[p] = copyAttributes(obj[p]);
	 }
	 return retAttr;
     }

     function copyAttributes(attr){
	 var retAttr = {};
	 for (var p in attr){
	     retAttr[p] = attr[p];
	 }
	 return retAttr;
     }
     
     function copyAst(ast){
	 var i;  
	 var retAst =  []; 
	 var len = ast.length;
	 retAst.push(ast[0]);
	 retAst.push(copyAttributes(ast[1]));
	 for(i = 2; i < len; i++){
	     retAst.push(copyAst(ast[i]));
	 }
	 if(ast.hasOwnProperty('num')){
	     retAst.num = ast.num;
	 }
	 if(ast.hasOwnProperty('free')){
	     retAst.free = copyVariableMap(ast.free); 
 	 }
	 if(ast.hasOwnProperty('locals')){
	     retAst.locals = copyVariableMap(ast.locals); 
	 }
	 if(ast.hasOwnProperty('origAst')){
	     retAst.origAst = ast.origAst;
	 }
	 return retAst;
     }
     
     function dupConstraintsHelper(ast){
	 var num;
	 var retConstraints=[];
	 var len = ast.length;
	 var i;
	 if(ast.hasOwnProperty('num')){
	     num = ast.num;
	     retConstraints.push(makeConstraint('dup',[num]));
	    // dupAstNum[num] = 1;
	 }
	 for(i = 2; i < len ;i++){
	     retConstraints = retConstraints.concat(dupConstraintsHelper(ast[i]));
	 }
	 return retConstraints;
     }

     function dupConstraints(){
	 var p;
	 var retConstraints = [];
	 var num;
	 var i;
	 for(p in toBeCloned){
             for (i = 0 ; i < 1; i++){
		 retConstraints = retConstraints.concat(dupConstraintsHelper(functionClones[p][i]));
	     }
	 }
	 return retConstraints; 
     }
     

     function cloneConstraints(){
	 var p;
	 var retConstraints = [];
	 var num;
	 var i;
	 for(p in  functionClones){
	     if(toBeCloned.hasOwnProperty(p)){
		 for (i = 0 ; i <  functionClones[p].length; i++){
		     num =  functionClones[p][i].num;
		     retConstraints.push(makeConstraint('clone',[p,i+1,num]));
		 }
	     }
	     else{
		 retConstraints.push(relName('clone') +'(' +encodeLoc(p) + ',' + 'i' + ',' + encodeLoc(p) + ')');
	     }
	 }
	 return retConstraints;
     }

     function cloneFunctionConstraints(){
	 var p;
	 var constraint = "";
	 var num;
	 var i;
	 for(p in  toBeCloned){
             for (i = 0 ; i <  functionClones[p].length; i++){
		 constraint = constraint + '#begin clone function ' + p + '_' + i + '\n';
		 constraint = constraint + genConstraintsScopeNumber(functionClones[p][i], annotationsObj, encodeVar, encodeField, encodeLoc,encodeCon, getNextTempVar, getNextAstNumber, astNumberMap, relName, makeConstraint, functionClones, nClones, maxArity);
		 constraint = constraint + '#end clone function ' + p + '_' + i + '\n\n';
	     }
	 }
	 return constraint;
     }

     function attackerConstraints(){
	 var constraint;
	 var retConstraints = [];
	 var attackerNum = encodeVar('attacker_0_1');
	 var attackerObjAst = getNextAstNumber();
	 var attackerObjNum = encodeLoc(attackerObjAst);
	 var attackerFuncAst = getNextAstNumber();
	 var attackerFuncNum = encodeLoc(attackerFuncAst);
	 var attackerArrayAst = getNextAstNumber();
	 var attackerArrayNum = encodeLoc(attackerArrayAst);
	 var attackerConNum = encodeLoc('attackerCon');
	 var attackerCallSite = encodeCon(getNextAstNumber());
	 var adsafeRejectAnn = encodeField('$A$AdsafeRejectNot');

	 constraint =  
	
	 "APtsTo(l:L) output \n" +

	 "AActualPtsTo(l:L) outputtuples \n" +

	 makeConstraint('newObj',['attacker_0_1',attackerObjAst]) + ".\n" + 
	     
	 makeConstraint('newFunctionObj',['attacker_0_1',attackerFuncAst]) + ".\n" + 
	     
	 makeConstraint('newArrayObj',['attacker_0_1',attackerArrayAst]) + ".\n" + 

	 "FormalArg(" + attackerFuncNum + ",i," + attackerNum +").\n" +

	 "FormalRet(" + attackerFuncNum + ","+ attackerNum +").\n" +

	 // Accumulating all objects (Adsafe restriction applied).
	 
	 makeConstraint('loadDot',['attacker_0_1','attacker_0_1','$A$AdsafeRejectNot']) + ".\n" + 
	 
	 // Connecting all objects in all possible ways. Respects freeze constraints (Adsafe Restriction applied).
	 
//	 'HStoreDotWeak(l,' + adsafeRejectAnn + ',m) :- APtsTo(l), APtsTo(,m), !Precious(m), !Precious(l) .\n' +
	 
	 makeConstraint('storeDotWeak',['attacker_0_1','$A$AdsafeRejectNot','attacker_0_1']) + ".\n" + 

	 "HActualEverythingCon(l,i,m," + attackerNum + "," + attackerConNum  + "," +attackerCallSite+") :- APtsTo(l), APtsTo(m).\n" +

	 // The final Attacker points-to relations	 
	 "APtsTo(l) :- VPtsTo(" + attackerNum + ",l).\n" +
	     // We do need any provenance rule for the above rule
    
	 // The following is the current policy where we discard objects that are 'dups' which means created in the within
	 // the clone to some function.

	 "AActualPtsTo(l) :- APtsTo(l), !Dup(l).\n" + 


	 // INVERSE RULES
	 "Provenance(l:L) outputtuples \n" +
	 
	 "TPrecious(l:L) output \n" +

	 "IAPtsTo(l:L) output \n" +

	 "RAttacker1(l:L,m:L,i:I) output \n" +

	 "RAttacker2(l:L) output \n" +

	 "TPrecious("+attackerFuncNum+").\n" +
	 
	 "TPrecious(l) :- Precious(l) .\n" +
	     
	 "TPrecious(l) :- TPrecious(n), HPtsTo(l," + encodeField('$A$AdsafeRejectNot') + ",n). \n" + 

	 "RAttacker1(l,m,i) :- IHActualEverythingCon(l,i,m," + attackerNum + "," + attackerConNum  + "," + attackerCallSite +"), APtsTo(l), APtsTo(m). \n" +

	 "RAttacker2(l) :- IAPtsTo(l), VPtsTo(" + attackerNum + ",l).\n" +

	 "IAPtsTo(l) :- RAttacker1(l,m,i). \n" +

	 "IAPtsTo(m) :- RAttacker1(l,m,i). \n" +

	 "IVPtsTo(" + attackerNum + ",l) :- RAttacker2(l). \n" +
	    
	 "IAPtsTo(l) :- AActualPtsTo(l), Precious(l).\n" +

	 "Provenance(l) :- IHActualEverythingCon(l,i,m," + attackerNum + "," + attackerConNum  + "," + attackerCallSite +") .\n";

	 astNumberMap[attackerObjAst] = ['IdExpr', {name:'AttackerObject'}];
	 astNumberMap[attackerFuncAst] = ['FunctionDecl', {},["IdPatt",{name:'attackerFunction'}],['ParamDecl',{}]];
	 astNumberMap[attackerFuncAst].isAttacker = 1;
	 astNumberMap[attackerArrayAst] = ['IdExpr', {name:'AttackerContext'}];
	 
	 return constraint;
     }

     
     function indentSpace(indent){
	 var i = 0; 
	 var result = "";
	 for(i = 0; i < indent; i++){
	     result = result + ' ';
	 }
	 return result;
     }
     
     function renderConstraints(constraintList, initIndent){
	 var i = 0; 
	 var len = constraintList.length;
	 var result = "";
	 var indent = initIndent;
	 for(i = 0; i < len;i++){
	     if((constraintList[i]).split(' ')[0] === '#begin'){
		 //TAKE SUBSTRING HERE.
		 result = result + indentSpace(indent)+ constraintList[i] + '.' + '\n'; 
		 indent = indent + 4;
		 
	     }
	     else if((constraintList[i]).split(' ')[0] === '#end'){
		 indent = indent - 4;
		 result = result + indentSpace(indent)+ constraintList[i] + '.' + '\n'; 
		 
	     }
	     else{
	     result = result + indentSpace(indent)+ constraintList[i] + '.' + '\n'; 
	     }
	 }

	 return result;
     }

    
     var dConstraints = dupConstraints();
     var cConstraints =  cloneConstraints();
     var cfConstraints = cloneFunctionConstraints();
     var aConstraints = attackerConstraints();
     
     var result = "#begin attacker\n\n";
     result = result + renderConstraints(dConstraints,0);
     result = result + renderConstraints(cConstraints,0);
     result = result + '\n\n' + cfConstraints;
     result = result + '\n\n' + aConstraints;
     result = result + '#end attacker \n';

     return result;
 }

 
