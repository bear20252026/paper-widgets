// Lumiloom on its China address (lumiloom.cn, www.lumiloom.cn): the record number that address must show at the foot of its
// home page. index.html asks for this file on that address and on no other; and the file does nothing anywhere else.
(function(){
  if(!/^(www\.)?lumiloom\.cn$/.test(location.hostname)) return;
  var a=document.createElement('a'), credit=document.querySelector('.credit');
  a.id='icp'; a.className='icp'; a.lang='zh-CN'; a.href='https://beian.miit.gov.cn/'; a.target='_blank'; a.rel='noopener noreferrer';
  a.textContent='陕ICP备2026034165号-1';
  if(/[?&]clean=/.test(location.search)) a.style.display='none';   // capture aid: the bare stage, as for the credit
  document.documentElement.classList.add('cn');
  credit.parentNode.insertBefore(a,credit.nextSibling);
})();
