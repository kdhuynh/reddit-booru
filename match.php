<script type="text/javascript">
window.parent.imageSearchCallback(<?php

require('lib/aal.php');

$out = null;

if (isset($_FILES['uplImage']) && is_uploaded_file($_FILES['uplImage']['tmp_name'])) {

	$tmpFile = 'cache/' . uniqid();
	if (move_uploaded_file($_FILES['uplImage']['tmp_name'], $_SERVER['DOCUMENT_ROOT'] . '/' . $tmpFile)) {
		$results = Api\Post::reverseImageSearch([ 'imageUri' => $_SERVER['DOCUMENT_ROOT'] . '/' . $tmpFile, 'count' => 6, 'getSource' => true, 'sources' => Lib\Url::Post('sources', '1') ]);
		if ($results) {
			$out = new stdClass;
			$out->body = $results;
			$out->body->original = $tmpFile;
		}
	}

}

echo json_encode($out);

?>);
</script>