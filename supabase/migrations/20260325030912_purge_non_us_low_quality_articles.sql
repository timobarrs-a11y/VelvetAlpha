
/*
  # Purge non-US and low-quality articles

  Removes articles from:
  - Nigerian/African news sites (punchng, vanguard, etc.)
  - Canadian news sites (cbc.ca, globeandmail, blogto, etc.)
  - UK/foreign sites not caught previously
  - Low-quality/fringe sites (shtfplan, antiwar, r-bloggers, saashunt, etc.)
  - Press release / academic / niche sites (globenewswire, plos.org, rsc.org, hbs.edu, redhat, kevinmd, etc.)
  - Sports blogs and hyperlocal sites (onefootdown, theleadsm, thetimes-tribune, etc.)
  - Spanish-language sports (marca.com)
*/

DELETE FROM news_articles
WHERE
  -- Nigerian sources
  url ~* '(punchng\.com|vanguardngr|premiumtimesng|channelstv|dailypost\.ng|guardian\.ng|businessday\.ng|blueprint\.ng|dailytrust|leadership\.ng|tribune\.ng|thenation\.ng)'
  OR source ~* '(the punch|punch nigeria|vanguard|premium times|channels tv|daily trust|daily post nigeria)'
  
  -- Canadian sources  
  OR url ~* '(cbc\.ca|globeandmail|torontostar|nationalpost|ctvnews|blogto\.com|financialpost\.com|theglobeandmail)'
  OR source ~* '(cbc news|globe and mail|toronto star|national post|ctv news|blogto|financial post)'
  
  -- Pakistani/Indian sources
  OR url ~* '(connectedpakistan|businessrecorder|samaa|arynews|dunyanews|geo\.tv|thenews\.com\.pk|tribune\.com\.pk|express\.com\.pk|ndtv|timesofindia|hindustantimes|thehindu)'
  OR source ~* '(connected pakistan|times of india|hindustan times|the hindu|ndtv|dawn|geo tv|ary news|dunya|samaa)'
  
  -- Fringe / low-quality / conspiracy sites
  OR url ~* '(shtfplan\.com|antiwar\.com|zerohedge|globalresearch|activistpost|beforeitsnews|naturalnews|infowars|breitbart|oilprice\.com|slashdot\.org|freerepublic|wnd\.com|theblaze)'
  OR source ~* '(shtfplan|antiwar|zero hedge|breitbart|infowars|natural news|before its news|oilprice|slashdot|free republic|the blaze|wnd)'
  
  -- Press releases / academic / corporate blogs
  OR url ~* '(globenewswire\.com|prnewswire\.com|businesswire\.com|plos\.org|rsc\.org|hbs\.edu|redhat\.com|kevinmd\.com|r-bloggers\.com|saashunt\.best|overcomingbias\.com|brandingstrategyinsider\.com|nextbigwhat\.com)'
  OR source ~* '(globenewswire|pr newswire|business wire|plos|royal society of chemistry|r-bloggers|saashunt|kevinmd|redhat|hbs)'
  
  -- Hyperlocal / low-tier sports blogs
  OR url ~* '(onefootdown\.com|theleadsm\.com|thetimes-tribune\.com|fourstateshomepage\.com|yourbasin\.com|wfmynews2\.com|alltoc\.com|bleedingcool\.com|siliconangle\.com)'
  OR source ~* '(one foot down|theleadsm|thetimes-tribune|fourstateshomepage|yourbasin|kmid|local 2 news|alltoc|bleeding cool|siliconangle)'
  
  -- Spanish-language
  OR url ~* '(marca\.com)'
  OR source = 'Marca'
  
  -- Other low-quality
  OR url ~* '(mediaite\.com|rawstory\.com|brobible\.com|phillymag\.com|247wallst\.com|theleadsm|overcomingbias)'
  OR source ~* '(mediaite|raw story|brobible|phillyMag|247 wall st)'
;
